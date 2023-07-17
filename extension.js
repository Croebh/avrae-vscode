const vscode = require('vscode');
const axios = require('axios');
const path = require("path");
/**
 * @param {vscode.ExtensionContext} context
 */
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

async function activate(context) {
	const uuid_pattern = /[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}/ig;
	let instance = await setup()
	
	vscode.workspace.onDidChangeConfiguration(async event => {
		if (event.affectsConfiguration('avrae.token')) {
			instance = await setup()
		}
	});
	
	let getGvar = vscode.commands.registerCommand('avrae-utilities.getGvar', async function () {

		// Check if file name == gvarID + '.gvar otherwise get
		let editor = vscode.window.activeTextEditor;
		var gvarID = "";
		var filePath = editor ? editor.document.fileName : "";
		var fileName = path.basename(filePath);
		
		if (editor && fileName.match(uuid_pattern)) {
			gvarID = fileName.match(uuid_pattern)[0]
		};

		if (!gvarID) {
			gvarID = await vscode.window.showInputBox({
				ignoreFocusOut: true,
				title: "What GVAR would you like to get Test?"
			});
			gvarID = gvarID.match(uuid_pattern)[0]
		}

		if (gvarID && uuid_pattern.test(gvarID)) {
			const result = await instance.get("/customizations/gvars/" + gvarID);
			
			if (result.status != 200 ) {
				vscode.window.showInformationMessage("Error!");
			}

			// Check if file name == gvarID + '.gvar'
			// If so, delete the file, replace with new contents
			// Otherwise, new doc
			if (editor && fileName.match(uuid_pattern)) {
				await editor.edit(editBuilder => {
					var firstLine = editor.document.lineAt(0);
					var lastLine = editor.document.lineAt(editor.document.lineCount - 1);
					var textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
					editBuilder.delete(textRange);
				});
				await editor.edit(editBuilder => {
					editBuilder.insert(new vscode.Position(0, 0), result.data.value);
				});
			} else {
				vscode.workspace.openTextDocument(
					{
						content: result.data.value, 
						language: "python"
					}
				).then((new_doc) => {
					vscode.window.showTextDocument(new_doc);
					vscode.window.showInformationMessage(
						"Remember to save the file as `" + gvarID + ".gvar` so it can be updated later.",
						"Copy File Name").then((value) => {
						if (value) {
							vscode.env.clipboard.writeText(gvarID + ".gvar");
						}
					});
				});
			}
			vscode.window.showInformationMessage("Gvar ID: " + gvarID + "\nSuccessfully Grabbed");
		}

		

		
	});

	let updateGvar = vscode.commands.registerCommand('avrae-utilities.updateGvar', async function () {

		// Check if file name == gvarID + '.gvar otherwise get
		const editor = vscode.window.activeTextEditor;
		var gvarID = "";
		var filePath = editor ? editor.document.fileName : "";
		var fileName = path.basename(filePath);
		
		var firstLine = editor.document.lineAt(0);
		var lastLine = editor.document.lineAt(editor.document.lineCount - 1);
		var textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
		var newData = editor.document.getText(textRange);

		if (newData.length > 100000) {
			vscode.window.showInformationMessage("Gvars are limited to 100k characters.")
			return
		}

		if (editor && fileName.match(uuid_pattern)) {
			gvarID = fileName.match(uuid_pattern)[0]
			const getResult = await instance.get("/customizations/gvars/" + gvarID);

			if (getResult.status != 200 ) {
				vscode.window.showInformationMessage("Error!");
			}


			var payload = getResult.data
			payload.value = newData
			const postResult = await instance.post("/customizations/gvars/" + gvarID, payload)
			if (postResult.status === 200 ) {
				vscode.window.showInformationMessage("Gvar ID: " + gvarID + "\nSuccessfully Updated");
			} else {
				vscode.window.showInformationMessage("Error!");
			}
		};
	});

	// TODO

	// Publish v0.0.1? haha

	context.subscriptions.push(getGvar);
	context.subscriptions.push(updateGvar);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
