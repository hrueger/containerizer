const figlet = require("figlet");
const chalk = require("chalk");
const clear = require("clear");
const inquirer = require("inquirer");
const findUp = require("find-up");
const fs = require("fs");
const path = require("path");
const confirm = require("inquirer-confirm");
const taskz = require("taskz");
const rimraf = require("rimraf");
const {exec} = require("child_process");

function getVersion() {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"))).version;
}

export async function cli(args) {
    clear();
    console.log(chalk.cyan("Welcome to"));
    console.log(chalk.cyan(figlet.textSync("Containerizer")));
    console.log("\n");
    console.log(chalk.blue("Thanks for using this tool. Feel free to contribute by creating pull requests or reporting issues on GitHub!"));
    console.log("\n");
    
    if (args[2] == "help" || args[2] == "--help") {
        console.log(chalk.green("Help:\nPlease see https://github.com/hrueger/containerizer/blob/master/README.md"));
        process.exit();
    }
    if (args[2] == "version" || args[2] == "--version") {
        console.log(chalk.green(`v${getVersion()}`));
        process.exit();
    }
    
    let config = {
        imageName: path.dirname(__dirname).split(path.sep).pop(),
        imageVersion: "1.0.0",
        imageMaintainer: undefined,
        imageMaintainerUsername: undefined,
        branch: "master",
        commit: "",
        repository: undefined,
        ngDestDir: undefined,
        ngSrcDir: undefined,
        customNgBuildCmd: undefined,
        startFile: undefined,
        npmInstallDirs: undefined,
        filesToCreate: `{
            'path': 'path/to/my/file',
            'template': 'typescript',
            'rootVariableName': 'environment',
            'properties': [
                'apiUrl',
                'appUrl',
                'mySecretKey'
            ],
            'presetProperties': {
                'production': true
            }
        },`
    }

    const packageJsonPath = await findUp("package.json");
    if (packageJsonPath) {
        console.log(chalk.green("A \"package.json\" file was found and is used for autocomplete."));
        const jsonContent = JSON.parse(fs.readFileSync(packageJsonPath).toString());
        if (jsonContent) {
            config.imageName = jsonContent.name;
            config.imageMaintainer = jsonContent.author;
            config.imageVersion = jsonContent.version;
        }
    } else {
        console.log(chalk.yellow("No \"package.json\" file was found."));
    }

    const configJsonPath = await findUp("containerizer.json");
    if (configJsonPath) {
        console.log(chalk.green("A \"containerizer.json\" file was found and is used for autocomplete.\n"));
        const jsonContent = JSON.parse(fs.readFileSync(configJsonPath).toString());
        if (jsonContent) {
            Object.keys(jsonContent).forEach((key) => {
                if (jsonContent[key]) {
                    config[key] = jsonContent[key];
                }
            });
        }
        if (args[2] != "build" && !await ask("Would you like to build the image with your last configuration loaded from \"containerizer.json\"?", false)) {
            askAllQuestions(args, config);
        } else {
            build();
        }
    } else {
        console.log(chalk.yellow("No \"containerizer.json\" file was found.\n"));
        askAllQuestions(args, config);
    }
}

async function build() {
    const config = JSON.parse(fs.readFileSync(await findUp("containerizer.json")));
    const fullImageName = `${config.imageMaintainerUsername}/${config.imageName.toLowerCase()}:v${config.imageVersion}`;
    const tasks = taskz([
        {
            text: "Creating workspace",
            task: () => {
                if (fs.existsSync("buildWorkspace")) {
                    rimraf.sync("buildWorkspace");
                }
                fs.mkdirSync("buildWorkspace");
            }
        },
        {
            text: "Creating \"Dockerfile\"",
            task: async () => {
                fs.copyFileSync(path.join(__dirname, "../laterInContainer/package.json"), "buildWorkspace/package.json");
                fs.copyFileSync(path.join(__dirname, "../laterInContainer/package-lock.json"), "buildWorkspace/package-lock.json");
                fs.copyFileSync(await findUp("containerizer.json"), "buildWorkspace/containerizer.json");
                fs.writeFileSync("buildWorkspace/Dockerfile", `
# Created by Containerizer
# Copyright H. Rüger, 2020

FROM mhart/alpine-node:slim-12.14

LABEL maintainer="${config.imageMaintainer}"
LABEL name="${config.imageName}"
LABEL version="${config.imageVersion}"

RUN apk add --update npm
COPY . /app
RUN cd /app && npm i
EXPOSE 80
CMD    ["node", "/app/install.js"]
`);
            },
        },
        {
            text: "Build docker image",
            task: async () => {
                //console.log(await execShellCommand(`docker build . -t ${fullImageName}`, {cwd: "buildWorkspace"}));
            }
        },
    ]);
    await tasks.run().catch((err) => {
        console.error(err);
    });
    let quit = false;
    let lastStatusMessage = "Finished building the docker image!";
    do {
        const answer = await inquirer.prompt([
            {
                type: "list",
                message: `${lastStatusMessage} What do you want to do?`,
                choices: [
                    {name: "Publish image to Docker Hub", value: "publish"},
                    {name: "Save docker image as \".tar\"", value: "save"},
                    {name: "Generate \"docker-compose.yml\" file with environment variables", value: "docker-compose"},
                    {name: "Generate \"docker run\" command with environment variables", value: "docker run"},
                    {name: "Exit", value: "exit"}
                ],
                name: "whatToDo",
            }
        ]);
        switch(answer.whatToDo) {
            case "publish":
                await execShellCommand(`docker push ${fullImageName}`);
                lastStatusMessage = "Executed \"docker push\"."
                break;
            case "publish":
                await execShellCommand(`docker save ${fullImageName} --output $${fullImageName.text.replace(/[\W_]+/g,"_")}.tar`);
                lastStatusMessage = "Executed \"docker save\"."
                break;
            case "docker-run":
                console.log("Not supported yet!");
                lastStatusMessage = "";
                break;
            case "docker-compose":
                console.log(`
version: "3.7"
services:
    yourContainerName:
        image: ${fullImageName}
        ports:
            - "80"
        restart_policy:
            condition: on-failure
        environment:
            ${removeDuplicates(config.filesToCreate.map((file) => file.properties).flat()).map((v) => `${v}: 'valueFor_${v}'`).join("\n            ")}
`);
                lastStatusMessage = "Sucessfully generated \"docker-compose.yml\".";
                break;
            case "exit":
                quit = true;
                break;
        }
    } while (!quit);
    
    process.exit();
}

function execShellCommand(cmd, options) {
    return new Promise((resolve, reject) => {
        exec(cmd, options, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
            }
            resolve(stdout? stdout : stderr);
        });
    });
}

function removeDuplicates(array) {
    return array.filter((a, b) => array.indexOf(a) === b) ;
};

function askAllQuestions(args, config) {
    const questions = [
        {
            type: "input",
            name: "imageName",
            message: "Name of the image:",
            default: config.imageName
        },
        {
            type: "input",
            name: "imageMaintainer",
            message: "Maintainer:",
            default: config.imageMaintainer
        },
        {
            type: "input",
            name: "imageMaintainerUsername",
            message: "Username of Maintainer:",
            default: config.imageMaintainerUsername
        },
        {
            type: "input",
            name: "imageVersion",
            message: "Version:",
            default: config.imageVersion,
        },
        {
            type: "input",
            name: "branch",
            message: "Branch:",
            default: config.branch,
        },
        {
            type: "input",
            name: "commit",
            message: "Commit (leave blank to use latest):",
            default: config.commit,
        },
        {
            type: "input",
            name: "repository",
            message: "Git Repository URL:",
            default: config.repository,
        },
        {
            type: "input",
            name: "ngSrcDir",
            message: "Source directory of Angular app:",
            default: config.ngSrcDir,
        },
        {
            type: "input",
            name: "ngDestDir",
            message: "Destination directory of Angular app:",
            default: config.ngDestDir,
        },
        {
            type: "input",
            name: "customNgBuildCmd",
            message: "Custom Angular build command (empty for default):",
            default: config.customNgBuildCmd,
        },
        {
            type: "input",
            name: "startFile",
            message: "The file to start in order to run the application:",
            default: config.startFile,
        },
        {
            type: "input",
            name: "npmInstallDirs",
            message: "Directories to run \"npm install\" (separate with spaces):",
            default: Array.isArray(config.npmInstallDirs) ? config.npmInstallDirs.join(" ") : config.npmInstallDirs,
            filter: (value) => {
                value = value.split(" ");
                if (value[0] == "") {
                    value = [];
                }
                return value;
            }
        }
    ];
    
    inquirer.prompt(questions).then(async (answers) => {
        answers = {...config, ...answers};
        fs.writeFileSync("./containerizer.json", JSON.stringify(answers));
        await ask("You can now edit the generated \"containerizer.json\" file to add filesToCreate, additionalBuilds and unnecessaryFilesAndDirs. Type in \"Y\" when you are done. See https://github.com/hrueger/containerizer/blob/master/README.md for examples.");
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