# Avrae Utilities for VSCode
A plugin for VSCode containing utilities for the [Avrae](https://avrae.io) Discord bot.

## Donations
If you like what I do, please support me [on Ko-Fi!](https://ko-fi.com/croebh)

## Important Note
This package makes a remote connection to the Avrae API in order to collect and update the information. It only does this by request, and will not make any outward connection without being prompted to by the user.

## Setup
In order for this plugin to have your permissions to grab and update your GVARs, Workshop Aliases, or Workshop Snippets, you need to give it your token.

1. Go to [Avrae](https://avrae.io) and log in to the dashboard
2. Press F12 to open the DevTools
3. Go to the 'Application' tab
4. On the left, select 'https://avrae.io' under 'Local Storage'
5. Copy the 'Value' next to the 'avrae-token' key
6. In VSCode, go to File -> Preferences -> Settings 
7. Under Extensions, select Avrae Utilities pasting the copied token into the "Avrae: Token" setting

### Note
Please keep this token private, as anyone who gains access to this token could potentially gain access to your Discord account.

## Features
This plugin contains the following features:

### Draconic Syntax
Handy syntax highlighting for the Draconic language (Subset of Python) that Avrae uses for aliasing. Its set up to work automatically on `*.alias`, `*.snippet`, and `*.gvar` filetypes.

### Get and Update GVARs
Using the ``Avrae Utilities: Get GVAR`` and ``Avrae Utilities: Update GVAR`` commands in the Command Pallete, you can retrieve and update GVARs without the need to visit the dashboard. If you want to save them locally, you can use the file extension ``.gvar``, and include the ID for the GVAR anywhere in the rest of the file name. You can have labels/descriptions before or after the ID, allowing you to organize your GVARs.