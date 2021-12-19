const vscode = require('vscode');
const axios = require('axios');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	const token = vscode.workspace.getConfiguration('avrae').get('token');
	const instance = await axios.create({
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
	
	let disposable = vscode.commands.registerCommand('avrae-test.getGvar', async function () {
		// console.log(vscode.workspace.getConfiguration('avrae').get('token'));
		// vscode.window.showInformationMessage('Hello World from avrae-test!');
		const gvarID = await vscode.window.showInputBox({
			ignoreFocusOut: true,
			title: "What GVAR would you like to get?"
		});
		const result = await instance.get("/customizations/gvars/" + gvarID);
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			editor.edit(editBuilder => {
				editBuilder.insert(editor.selection.active, result.data.value);
			});
		} else {
			vscode.workspace.openTextDocument(
				{
					content: result.data.value, 
					language: "json"
				}
			);
		}
	});

	context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
