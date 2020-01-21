const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const {install} = require("./install");

main();

async function main() {
    if (!fs.existsSync(path.join(__dirname, "containerizer_client_app_version.json"))) {
        console.log();
        console.log(chalk.green("First run detected, installing..."));
        console.log();
        await install();
        fs.writeFileSync("environment_cache", JSON.stringify(process.env));
        startApp();
    } else if (detectEnvChange()) {
        console.log();
        console.log(chalk.green("Environment change detected, rebuilding..."));
        console.log();

        // await install();
        // startApp();
    } else {
        startApp();
    }
}

function startApp() {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, "containerizer.json")));
    const clientAppProcess = spawn("node", [insideWorkDirPath(config.startFile, config)]);
    clientAppProcess.stdout.on("data", data => {
        console.log(chalk.cyan("Client app: ") + data);
    });
    clientAppProcess.stderr.on("data", data => {
        console.log(chalk.red("Client app: ") + data);
    });
    clientAppProcess.on('error', (error) => {
        console.log(chalk.red("Client app: ") + data);
    });
    clientAppProcess.on("close", code => {
        console.log(chalk.yellow(`Client app exited with code ${code}.`));
    });
}

function insideWorkDirPath(p, config) {
    return path.join(relativeToAbsolute(config.workingDirPath), p);
}

function relativeToAbsolute(p) {
    return path.join(__dirname, p);
}

function detectEnvChange() {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, "containerizer.json")));
    const envFromCache = JSON.parse(fs.readFileSync("environment_cache"));
    const envCurrent = process.env;
    const isSimilar = true;
    removeDuplicates(config.filesToCreate.map((file) => file.properties).flat()).forEach((prop) => {
        if (envFromCache[prop] != envCurrent[prop]) {
            console.log(prop, "EnvFromCache:", envFromCache[prop], "current", envCurrent[prop]);
            isSimilar = false;
        }
    });
    return isSimilar;
}

function removeDuplicates(array) {
    return array.filter((a, b) => array.indexOf(a) === b) ;
};