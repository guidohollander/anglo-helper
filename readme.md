# Anglo helper (CLI)

Anglo helper is a command line interface (CLI) that will assist with SVN switches and SVN updates of Anglo projects, detect missing projects, execute any general or component-level flyway scripts and validate the structure of Anglo specific projects.

## Requirements

* [Node.js](https://nodejs.org/dist/v16.17.0/node-v16.17.0-x64.msi) LTS 16.17.0 (including NPM 8.15.0).
* [NVM](https://4geeks.com/how-to/nvm-install-windows) when multiple versions of node.js version are required, i.e. when using Control panel.
* [Tortoise SVN](https://tortoisesvn.net/downloads.html) An SVN client for Windows.
* [Git](https://git-scm.com/)

## Installation steps

1. Start a terminal (i.e. git bash, windows terminal, powershell console) in a folder where you want to store the Anglo helper program 
2. Clone the git repo. Execute `git clone https://github.com/guidohollander/anglo-helper` in the terminal. It will create a new folder `anglo-helper`.
3. Navigate (change directory) into the anglo-helper folder and run `npm install -g`. It will automatically install dependencies for running Anglo helper and make it available 'globally' on your computer. It's now ready to be used.
4. Navigate (change directory) to one of your **workspace** folders
5. Run `anglo-helper`. Since it is the first run, a number of questions will be asked in order to create a profile in <workspace>/profile_1.json.

## Command line options (anglo-helper --version)

<img src="https://raw.githubusercontent.com/guidohollander/anglo-helper/master/doc/help.png" alt="help" width="500"/>

## Examples

* Run Anglo Helper with the default profile (profile_1.json). At first run, the default profile is created based on a questionaire.

    $ `anglo-helper`
    
* Change or copy your profile
    
    $ `nano profile_1.json` or `notepad profile_1.json`

* Run Anglo Helper with an alternative profile (i.e., anglo-helper_profile_update.json)

    $ `anglo-helper --profile profile_update.json`

* Select an svn version to upgrade or downgrade your current workspace to. Anglo-helper will automatically switch

    $ `anglo-helper --select`

* Perform a deployment check, meaning that all externals should have been tagged

    $ `anglo-helper --deploymentCheck`
    
* Override profile settings for to enable switch, update, flyway, verbose. Can be combined

    $ `anglo-helper --update
    $ `anglo-helper --flyway --verbose    
    etc.
    
* Force anglo-helper to perform actions on a single project only. Can be combined with other arguments

    $ `anglo-helper --project 'SC Tax return'
    
* Force anglo-helper to start operating starting from a particular row or project name and skip all projects that are alphabetically before that. These options can, but should not be combined since row numbers are relative to the complete set.

    $ `anglo-helper --startRow 10
    $ `anglo-helper --startProject 'SC Tax return'
    
## License

The MIT License (MIT)

Copyright (c) 2020 Hollander Consulting

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
