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

### Get  GVARs
Using the ``Avrae Utilities: Get GVAR`` command in the Command Pallete, you can retrieve GVARs without the need to visit the dashboard. If you want to save them locally, include the ID for the GVAR anywhere in the rest of the file name. You can have labels/descriptions before or after the ID, allowing you to organize your GVARs.

## Get Collections
Using the  ```Avrae Utilities: Get Collection``` command in the Command Pallete, you can retrieve all items in a collection. This will also create a `collection.io` file for mapping. You can either just update the `collection.io` file or pull all content form the collection. The names of the files must align with the name of the alias/snippet in the collection.

## Get Item/Spell Tome
Using the  ```Avrae Utilities: Get Item Tome``` or ```Avrae Utilties: Get Spell Tome```  commands in the Command Pallete, you can retrieve all items in a homebrew tome. If you want to save them locally, include the ID of the tome anywhere in the file name. You can labels/descriptions before or after the ID, allowing you to organize your tomes. Just save them either with a `.spell` or `.item` extension so the update command knows which one to update.

## Get Customizations
Using the  ```Avrae Utilities: Get Personal Customizations``` command in the Command Pallete, you will be prompted for what to save. This will download a customization and setup the file. Be sure to save the file with an appropriate file extension so the update command knows which one to update. The name must match the customization name.

## Push updates
Using the  ```Avrae Utilities: Push Update``` command in the Command Pallete will push an update to Avrae based on the file/location you are working in. It wil check for GVAR/Homebrew content first, then collections, and then it will push to customizations. 