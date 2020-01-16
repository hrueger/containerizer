const figlet = require('figlet');
const chalk = require('chalk');
const clear = require('clear');
const inquirer = require('inquirer');
const findUp = require('find-up');
const fs = require('fs');
const path = require('path');
const confirm = require('inquirer-confirm');

export async function cli(args) {
    clear();
    console.log(chalk.cyan("Welcome to"));
    console.log(chalk.cyan(figlet.textSync('Containerizer')));
    console.log(chalk.cyan("v1.0.0"));
    console.log("\n");
    console.log(chalk.blue("Thanks for using this tool. Feel free to contribute by creating pull requests or reporting issues on GitHub!"));
    console.log("\n");
    
    let config = {
        containerName: path.dirname(__dirname).split(path.sep).pop(),
        containerVersion: "1.0.0",
        containerMaintainer: undefined,
        branch: "master",
        commit: "",
        repository: undefined,
        ngDestDir: undefined,
        ngSrcDir: undefined,
        customNgBuildCmd: undefined,
        startFile: undefined,
        npmInstallDirs: undefined,
    };

    const packageJsonPath = await findUp("package.json");
    if (packageJsonPath) {
        console.log(chalk.green("A 'package.json' file was found and is used for autocomplete."));
        const jsonContent = JSON.parse(fs.readFileSync(packageJsonPath).toString());
        if (jsonContent) {
            config.containerName = jsonContent.name;
            config.containerMaintainer = jsonContent.author;
            config.containerVersion = jsonContent.version;
        }
    } else {
        console.log(chalk.yellow("No 'package.json' file was found."));
    }

    const configJsonPath = await findUp("containerizer.json");
    if (configJsonPath) {
        console.log(chalk.green("A 'containerizer.json' file was found and is used for autocomplete.\n"));
        const jsonContent = JSON.parse(fs.readFileSync(configJsonPath).toString());
        if (jsonContent) {
            config = jsonContent;
        }
        if (args[2] != "build" && !await ask("Would you like to build the container with your last configuration?", false)) {
            askAllQuestions(args, config);
        }
    } else {
        console.log(chalk.yellow("No 'containerizer.json' file was found.\n"));
        askAllQuestions(args, config);
    }
}

function build() {
    console.log("Building!");
    // ToDo
    console.log("Finished!");
    process.exit();
}

function askAllQuestions(args, config) {
    const questions = [
        {
            type: 'input',
            name: 'containerName',
            message: "Name of the container:",
            default: config.containerName
        },
        {
            type: 'input',
            name: 'containerMaintainer',
            message: "Maintainer:",
            default: config.containerMaintainer
        },
        {
            type: 'input',
            name: 'containerVersion',
            message: "Version:",
            default: config.containerVersion,
        },
        {
            type: 'input',
            name: 'branch',
            message: "Branch:",
            default: config.branch,
        },
        {
            type: 'input',
            name: 'commit',
            message: "Commit (leave blank to use latest):",
            default: config.commit,
        },
        {
            type: 'input',
            name: 'repository',
            message: "Git Repository URL:",
            default: config.repository,
        },
        {
            type: 'input',
            name: 'ngSrcDir',
            message: "Source directory of Angular app:",
            default: config.ngSrcDir,
        },
        {
            type: 'input',
            name: 'ngDestDir',
            message: "Destination directory of Angular app:",
            default: config.ngDestDir,
        },
        {
            type: 'input',
            name: 'customNgBuildCmd',
            message: "Custom Angular build command (empty for default):",
            default: config.customNgBuildCmd,
        },
        {
            type: 'input',
            name: 'startFile',
            message: "The file to start in order to run the application:",
            default: config.startFile,
        },
        {
            type: 'input',
            name: 'npmInstallDirs',
            message: "Directories to run 'npm install' (separate with spaces):",
            default: Array.isArray(config.npmInstallDirs) ? config.npmInstallDirs.join(" ") : config.npmInstallDirs,
            filter: (value) => {
                value = value.split(" ");
                if (value[0] == "") {
                    value = [];
                }
                return value;
            }
        },
    ];
    
    inquirer.prompt(questions).then(answers => {
        //console.log(answers);
        fs.writeFileSync("./containerizer.json", JSON.stringify(answers));
        build();
    });
}

function ask(question, d = true) {
    return new Promise((resolve, reject) => {
        confirm({
            question: question,
            default: d,
          }).then(() => {
              resolve(true);
          }).catch(() => {
              resolve(false);
          })
    });
}