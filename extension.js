const vscode = require('vscode');
const axios = require('axios');
const path = require("path");
const fs = require("fs");

async function setup() {
	let token = vscode.workspace.getConfiguration('avrae').get('token');
	let instance = await axios.create({
		baseURL: "https://api.avrae.io/",
		headers: {
			'Authorization': token,
			'Accept': 'application/json, text/plain, */*',
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36',
			'Content-Type': 'application/json',
			'Sec-Fetch-Site': 'same-site',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Dest': 'empty'
		}
	});
	return instance
}

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	const uuid_pattern = /[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}/i;
	const oid_pattern = /^[a-f\d]{24}(?=\.\w+|$)/i;
	const customization_map = {
		'commands': 'alias',
		'snippet': 'snippet',
		'value': 'uvar'
	}
	const customization_extensions_map = {
		'alias': 'aliases',
		'snippet': 'snippets',
		'uvar': 'uvars'
	}
	const size_limit_map = {
		"alias": 100000,
		"snippet": 5000,
		"uvar": 10000
	}
	let instance = await setup()
	
	vscode.workspace.onDidChangeConfiguration(async event => {
		if (event.affectsConfiguration('avrae.token')) {
			instance = await setup()
		}
	});

	async function insertIntoDocument(editor, content){
		await editor.edit(editBuilder => {
			var firstLine = editor.document.lineAt(0)
			var lastLine = editor.document.lineAt(editor.document.lineCount-1)
			var textRange = new vscode.Range(firstLine.range.start, lastLine.range.end)
			editBuilder.delete(textRange)
		})
		await editor.edit(editBuilder => {
			editBuilder.insert(new vscode.Position(0, 0), content)
		})
	}
	
	let getGvar = vscode.commands.registerCommand('avrae-utilities.getGvar', async function () {

		// Check if file name == gvarID + '.gvar otherwise get
		let editor = vscode.window.activeTextEditor;
		var gvarID = "";
		var filePath = editor ? editor.document.fileName : "";
		var fileName = path.basename(filePath);
		
		if (editor && uuid_pattern.test(fileName)) {
			gvarID = fileName
		} 
		if (!gvarID) {
			let user_input = await vscode.window.showInputBox({
				ignoreFocusOut: true,
				title: "What Gvar would you like to get?",
				prompt: "Enter a Gvar ID",
			});
			if (user_input) {
				gvarID = user_input
			} else {
				vscode.window.showInformationMessage("No Gvar ID provided.");
				return
			}
		}

		if (uuid_pattern.test(gvarID)) {
			gvarID = gvarID.match(uuid_pattern)[0]
			const result = await instance.get(`/customizations/gvars/${gvarID}`);
			
			if (result.status != 200 ) {
				vscode.window.showInformationMessage("Error!");
			}

			// Check if file name == gvarID + '.gvar'
			// If so, delete the file, replace with new contents
			// Otherwise, new doc
			if (editor && fileName.match(uuid_pattern)) {
				await insertIntoDocument(editor, result.data.value)
			} else {
				vscode.workspace.openTextDocument({
					content: result.data.value, 
					language: "python"
				}).then((new_doc) => {
					vscode.window.showTextDocument(new_doc);
					vscode.window.showInformationMessage(
						`Remember to save the file as '${gvarID}.gvar' so it can be updated later.`,
						"Copy File Name").then((value) => {
						if (value) {
							vscode.env.clipboard.writeText(`${gvarID}.gvar`);
						}
					});
				});
			}
			vscode.window.showInformationMessage(`Gvar ID: ${gvarID}\nSuccessfully Grabbed`);
		} else {
			vscode.window.showInformationMessage("Invalid Gvar ID provided.");
		}
	});

	let getCollection = vscode.commands.registerCommand('avrae-utilities.getCollection', async function () {
		let collectionID = "";
		let getContent = false
		let currentCollection = getCollectionIO(true) ? `${getCollectionIO(true).collection}` : ""

		let user_input = await vscode.window.showInputBox({
			ignoreFocusOut: true,
			title: "What collection would you like to get?",
			prompt: "Enter a Collection ID",
			value: currentCollection
		});

		if (user_input){
			collectionID = user_input
		} else {
			vscode.showInformationMessage("No Collection ID Provided");
			return
		}

		let pull_all = await vscode.window.showInputBox({
			ignoreFocusOut: true,
			title: "Would you like to pull all the collection content into the current directory?",
			prompt: "Pull all content?",
			value: "yes"
		})

		if (pull_all && pull_all.toLowerCase() == 'yes'){
			getContent = true
		}

		const result = await instance.get(`/workshop/collection/${collectionID}/full`);

		if (result.status != 200){
			vscode.window.showInformationMessage("Error!")
		}

		const collection = result.data.data


		let collectionIO = {name: collection.name, collection: collection._id, aliases: {}, snippets: {}}

		for (let alias of collection.aliases){
			findNestedAliases(alias, collectionIO, "", getContent)
		}

		for (let snippet of collection.snippets){
			collectionIO['snippets'][snippet.name] = snippet._id

			if (getContent){ 
				writeFile(`${snippet.name}.snippet`, snippet.code)
	
				if (snippet.docs.length > 0){
					writeFile(`${snippet.name}.md`, snippet.docs)
				}
			}	
		}

		if (getContent && collection.description.length > 0){
			writeFile("readme.md", collection.description)
		}

		writeFile('collection.io', JSON.stringify(collectionIO))

		vscode.window.showInformationMessage(`Complete!`);
		
	});

	let getCustomization = vscode.commands.registerCommand('avrae-utilities.getCustomization', async function () {
		const result = await instance.get(`/customizations`)

		if (result.status != 200){
			vscode.window.showInformationMessage("Error!")
		}

		const data = result.data
		let choices = []

		for (const key in data){
			choices.push(key)
		}
		let type = await vscode.window.showQuickPick(choices, {
			ignoreFocusOut: true,
			title: "Which type of customizations would you like to get?",
			prompt: "Which type of customization?"
		})

		if (!type){
			return
		}

		choices = []
		data[type].forEach(element => {
			choices.push(element.name)
		});
		
		let user_input = await vscode.window.showQuickPick(choices, {
			canPickMany: true,
			ignoreFocusOut: true,
			title: "Which type of customizations would you like to get?",
			prompt: "Which type of customization?"
		})

		if (!user_input){
			return
		}

		user_input.forEach(input => {
			const customization = data[type].find(e => e.name === input)
			if (customization){
				let found = false
				for (const [key, extension] of Object.entries(customization_map)){
					if (key in customization){
						found = true
						writeFile(`${input}.${extension}`, customization[key])
						break
					}
				}

				if (!found){
					vscode.window.showInformationMessage(`Customization content type not identified.`)	
				}
			} else {
				vscode.window.showInformationMessage(`Customization with name ${input} not found.`)
			}
		})

		vscode.window.showInformationMessage(`Complete!`);
	})

	let getSpellbook = vscode.commands.registerCommand('avrae-utilities.getSpellTome', async function () {
		let editor = vscode.window.activeTextEditor;
		var tomeID = "";
		var filePath = editor ? editor.document.fileName : "";
		var fileName = path.basename(filePath);

		if (editor && oid_pattern.test(fileName)){
			tomeID = fileName
		}

		if (!tomeID){
			let user_input = await vscode.window.showInputBox({
				ignoreFocusOut: true,
				title: "What Spell Tome would you like to get?",
				prompt: "Enter a spell tome ID",
			})

			if (user_input){
				tomeID = user_input
			} else {
				vscode.window.showInformationMessage("No spell tome ID provided")
				return
			}
		}

		if (oid_pattern.test(tomeID)){
			tomeID = tomeID.match(oid_pattern)[0]
			const result = await instance.get(`/homebrew/spells/${tomeID}`)

			if (result.status != 200){
				vscode.window.showErrorMessage("Error!")
			}

			const data = JSON.stringify(result.data.data.spells)
			if (editor && fileName.match(oid_pattern)){
				await insertIntoDocument(editor, data)
			} else {
				vscode.workspace.openTextDocument({
					content: data,
					language: "json"
				}).then((new_doc) => {
					vscode.window.showTextDocument(new_doc)
					vscode.window.showInformationMessage(
						`Remember to save the file as '${tomeID}.spell' so it can be updated later.`,
						"Copy File Name").then((value) => {
						if (value) {
							vscode.env.clipboard.writeText(`${tomeID}.spell`);
						}
					})
				})
			}
			vscode.window.showInformationMessage(`Spell Tome ID: ${tomeID}\nSuccessfully Grabbed`);
		} else {
			vscode.window.showInformationMessage("Invalid Spell Tome ID provided.");
		}	
	})

	let getItems = vscode.commands.registerCommand('avrae-utilities.getItemTome', async function () {
		let editor = vscode.window.activeTextEditor;
		var tomeID = "";
		var filePath = editor ? editor.document.fileName : "";
		var fileName = path.basename(filePath);

		if (editor && oid_pattern.test(fileName)){
			tomeID = fileName
		}

		if (!tomeID){
			let user_input = await vscode.window.showInputBox({
				ignoreFocusOut: true,
				title: "What Item Tome would you like to get?",
				prompt: "Enter an item tome ID",
			})

			if (user_input){
				tomeID = user_input
			} else {
				vscode.window.showInformationMessage("No item tome ID provided")
				return
			}
		}

		if (oid_pattern.test(tomeID)){
			tomeID = tomeID.match(oid_pattern)[0]
			const result = await instance.get(`/homebrew/items/${tomeID}`)

			if (result.status != 200){
				vscode.window.showErrorMessage("Error!")
			}

			const data = JSON.stringify(result.data.data.items)
			if (editor && fileName.match(oid_pattern)){
				await insertIntoDocument(editor, data)
			} else {
				vscode.workspace.openTextDocument({
					content: data,
					language: "json"
				}).then((new_doc) => {
					vscode.window.showTextDocument(new_doc)
					vscode.window.showInformationMessage(
						`Remember to save the file as '${tomeID}.item' so it can be updated later.`,
						"Copy File Name").then((value) => {
						if (value) {
							vscode.env.clipboard.writeText(`${tomeID}.item`);
						}
					})
				})
			}
			vscode.window.showInformationMessage(`Item Tome ID: ${tomeID}\nSuccessfully Grabbed`);
		} else {
			vscode.window.showInformationMessage("Invalid Item Tome ID provided.");
		}	
	})


	let pushUpdate = vscode.commands.registerCommand('avrae-utilities.pushUpdate', async function() {
		const editor = vscode.window.activeTextEditor;
		const fileName = editor ? editor.document.fileName : ""
		const fileExtension = path.extname(fileName).toLowerCase()
		const baseFile = path.basename(fileName, path.extname(fileName))
		
		// GVAR and Homebrew updates
		if (baseFile.match(uuid_pattern)){
			updateGVAR()
			return
		} else if (fileExtension == ".spell" && baseFile.match(oid_pattern)){
			updateSpellTome()
			return
		} else if (fileExtension == ".item" && baseFile.match(oid_pattern)){
			updateItemTome()
			return
		}
		
		// Collection Updates
		const collectionIO = getCollectionIO(true)
		if (collectionIO){
			if (['.snippet', '.md'].includes(fileExtension) && collectionIO.snippets.hasOwnProperty(baseFile)){
				updateCollectionContent('Snippets')
			} else if (['.alias', '.md'].includes(fileExtension) && collectionIO.aliases.hasOwnProperty(baseFile)){
				updateCollectionContent('Aliases')
			} else if (baseFile.toLowerCase() == "readme" && fileExtension == ".md"){
				let getResult = await instance.get(`/workshop/collection/${collectionIO.collection}/full`);
				if (getResult.status == 200 || getResult == 201){
					let newData = getFileContent(fileName)
					let collectionInfo = getResult.data.data
					let payload = {name: collectionInfo.name, description: newData, image: collectionInfo.image}
					let patchResult = await instance.patch(`/workshop/collection/${collectionIO.collection}`, payload);
	
					if (patchResult.status != 200){
						vscode.window.showInformationMessage("Error!");
					} else {
						vscode.window.showInformationMessage(`${collectionInfo.name} Readme \nSuccessfully Updated`)
					}
				}
			} 
		} else {
			updateCustomization()
		}
	})

	function findNestedAliases(alias, out, curName, getContent){
		curName = `${curName} ${alias.name}`.trim()
		out['aliases'][curName] = alias._id

		if (getContent){ 
			writeFile(`${curName}.alias`, alias.code)

			if (alias.docs.length > 0){
				writeFile(`${curName}.md`, alias.docs)
			}
		}	

		for (let childAlias of alias.subcommands){
			findNestedAliases(childAlias, out, curName, getContent)
		}
	}

	function writeFile(fileName, content){
		const editor = vscode.window.activeTextEditor;
		var filePath = editor ? vscode.Uri.parse(editor.document.uri.toString().replace(/\/[^\/]*$/, '')) : vscode.workspace.workspaceFolders[0].uri
		fs.writeFileSync(vscode.Uri.joinPath(filePath,`/${fileName}`).fsPath, content, {encoding: 'utf-8'})
	}

	function getFileContent(filePath, silent = false){
		let data = ""
		try{
			data = fs.readFileSync(filePath, 'utf-8')
		} catch(e){
			if (!silent){
				vscode.window.showInformationMessage("Unable to open file" + path.basename(filePath))
			}
			return null
		}
		return data
	}

	async function updateGVAR(){
		const editor = vscode.window.activeTextEditor;
		const fileName = editor ? editor.document.fileName : ""
		const baseFile = path.basename(fileName, path.extname(fileName))
		let newData = getFileContent(fileName)

		if (newData.length > 100000) {
			vscode.window.showInformationMessage("Gvars are limited to 100k characters.")
			return
		}

		let gvarID = baseFile.match(uuid_pattern)[0]

		const getResult = await instance.get(`/customizations/gvars/${gvarID}`);

		if (getResult.status != 200 ) {
			vscode.window.showInformationMessage("Error!");
		}

		var payload = getResult.data
		payload.value = newData
		const postResult = await instance.post(`/customizations/gvars/${gvarID}`, payload)
		
		if (postResult.status === 200 ) {
			vscode.window.showInformationMessage(`Gvar ID: ${gvarID}\nSuccessfully Updated`);
		} else {
			vscode.window.showInformationMessage("Error!");
		}
	}

	async function updateSpellTome(){
		const editor = vscode.window.activeTextEditor;
		const fileName = editor ? editor.document.fileName : ""
		const baseFile = path.basename(fileName, path.extname(fileName))
		let newData = getFileContent(fileName)

		let tomeID = baseFile.match(oid_pattern)[0]

		const getResult = await instance.get(`/homebrew/spells/${tomeID}`)

		if (getResult.status != 200 ) {
			vscode.window.showInformationMessage("Error!");
		}

		var payload = getResult.data.data

		payload.spells = JSON.parse(newData)
		
		const putResult = await instance.put(`/homebrew/spells/${tomeID}`, JSON.stringify(payload))

		if (putResult.status === 200 ) {
			vscode.window.showInformationMessage(`Spell Tome ID: ${tomeID}\nSuccessfully Updated`);
		} else {
			vscode.window.showInformationMessage("Error!");
		}
	}

	async function updateItemTome(){
		const editor = vscode.window.activeTextEditor;
		const fileName = editor ? editor.document.fileName : ""
		const baseFile = path.basename(fileName, path.extname(fileName))
		let newData = getFileContent(fileName)

		let tomeID = baseFile.match(oid_pattern)[0]

		const getResult = await instance.get(`/homebrew/items/${tomeID}`)

		if (getResult.status != 200 ) {
			vscode.window.showInformationMessage("Error!");
		}

		var payload = getResult.data.data

		payload.items = JSON.parse(newData)
		
		const putResult = await instance.put(`/homebrew/items/${tomeID}`, JSON.stringify(payload))

		if (putResult.status === 200 ) {
			vscode.window.showInformationMessage(`Item Tome ID: ${tomeID}\nSuccessfully Updated`);
		} else {
			vscode.window.showInformationMessage("Error!");
		}
	}

	async function updateCollectionContent(key){
		const editor = vscode.window.activeTextEditor;
		const fileName = editor ? editor.document.fileName : ""
		const fileExtension = path.extname(fileName).toLowerCase()
		const baseFile = path.basename(fileName, path.extname(fileName))
		const dataName = key == "Aliases" ? baseFile.split(" ").pop() : baseFile
		const collectionIO = getCollectionIO()

		let itemID = collectionIO[key.toLowerCase()][baseFile]
		let newData = getFileContent(fileName)
		let type = key.toLowerCase() == "aliases" ? "Alias" : "Snippet"
		let status = null

		if (!type || !itemID) {
			vscode.window.showInformationMessage("Error!")
			return
		}

		if ([".snippet", ".alias"].includes(fileExtension)){
			if (newData.length > 100000){
				vscode.window.showInformationMessage(`${key} are limited to 100k characters.`)
				return
			}

			let version = null
			let payload = {name: dataName, content: newData}

			await instance.post(`/workshop/${type.toLowerCase()}/${itemID}/code`, payload).then(res => {
				version = res.data.data.version
			})
			const putResult = await instance.put(`/workshop/${type.toLowerCase()}/${itemID}/active-code`, {'version': version})
			status = putResult.status
		} else if (fileExtension == ".md"){
			let payload = {name: dataName, docs: newData}
			const patchResult = await instance.patch(`/workshop/${type.toLowerCase()}/${itemID}`, payload)
			status = patchResult.status
		} else {
			vscode.window.showInformationMessage("Error!")
			return
		}

		if (status == 200 || status == 201){
			vscode.window.showInformationMessage(`${type}${fileExtension == ".md" ? " readme":""}: ${baseFile} (${itemID})\nSuccessfully Updated`)
		} else {
			vscode.window.showInformationMessage("Error!")
		}
	}

	async function updateCustomization(){
		const editor = vscode.window.activeTextEditor;
		const fileName = editor ? editor.document.fileName : ""
		const fileExtension = path.extname(fileName).toLowerCase()
		const baseFile = path.basename(fileName, path.extname(fileName))
		const result = await instance.get(`/customizations`)

		if (result.status != 200){
			vscode.window.showInformationMessage("Error!")
			return
		}

		const data = result.data

		for (const [key, extension] of Object.entries(customization_map)) {
			if (fileExtension == `.${extension}`){
				let customization = data[customization_extensions_map[extension]].find(e => e.name == baseFile)
				if (customization){
					let newData = getFileContent(fileName)
					
					if (newData.length > size_limit_map[extension]){
						vscode.window.showInformationMessage(`${key} are limited to ${size_limit_map[extension]} characters`)
						return
					}

					customization[key] = newData

					const postResult = await instance.post(`/customizations/${customization_extensions_map[extension]}/${customization.name}`, JSON.stringify(customization))

					if (postResult.status === 200 ) {
						vscode.window.showInformationMessage(`Personal ${extension}: ${customization.name}\nSuccessfully Updated`);
					} else {
						vscode.window.showInformationMessage("Error!");
					}
					break
				} else {
					vscode.window.showInformationMessage("Error!")
					return
				}
			}
		}
	}

	function getCollectionIO(suppressError = false){
		const editor = vscode.window.activeTextEditor;
		var filePath = editor ? path.dirname(editor.document.fileName) : vscode.workspace.workspaceFolders[0].uri

		let collectionIO = null

		try{
			collectionIO = JSON.parse(getFileContent(path.join(filePath, '/collection.io', true)))
		} catch (e){
			if (!suppressError){
				vscode.window.showInformationMessage("Unable to find collection.io")
			}
			return null
		}

		return collectionIO
	}
	// TODO

	// Publish v0.0.1? haha

	context.subscriptions.push(getGvar);
	context.subscriptions.push(getCollection)
	context.subscriptions.push(pushUpdate)
	context.subscriptions.push(getSpellbook)
	context.subscriptions.push(getItems)
	context.subscriptions.push(getCustomization)
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}