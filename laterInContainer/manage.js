const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const {install} = require("./install");
const http = require("http");


const config = JSON.parse(fs.readFileSync(path.join(__dirname, "containerizer.json")));

main();

async function main() {
    if (!fs.existsSync(path.join(__dirname, "containerizer_client_app_version.json"))) {
        console.log();
        console.log(chalk.green("First run detected, installing..."));
        console.log();
        fs.writeFileSync("./installStatus.json", JSON.stringify({stepNr: 0, totalSteps: 10, statusText: "Loading"}));
        const server = http.createServer(function (request, response) {
            response.writeHead(200, { "Content-Type": "text/html" });
            const data = JSON.parse(fs.readFileSync("./installStatus.json").toString());
            const percentage = data.stepNr / data.totalSteps * 100;
            response.end(`
<!DOCTYPE html>
<html>
<head>
<meta http-equiv="refresh" content="2"/>
<link href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-Vkoo8x4CGsO3+Hhxv8T/Q5PaXtkKtu6ug5TOeNV6gBiFeWPGFN9MuhOf23Q9Ifjh" crossorigin="anonymous">
</head>
<body>
<div class="container p-1 pt-5">
    <h1>${config.imageName} is installing...</h1>
    <h5>Status: ${data.statusText}</h5>
    <div class="progress">
        <div class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100" style="width:${percentage}%">
            ${percentage}%
        </div>
    </div>
    <p class="mt-3">Powered by <a href="https://github.com/hrueger/containerizer">Containerizer</a>.</p>
</div>
</body>
</html>
`, "utf-8");
        }).listen(80);
        console.log(chalk.yellow("Status server started on port 80"));
        await install();
        fs.writeFileSync("environment_cache", JSON.stringify(process.env));
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        console.log(chalk.yellow("Status server stopped in order to free port 80 for client app"));
        startApp();
    } else if (detectEnvChange()) {
        console.log();
        console.log(chalk.green("Environment change detected, rebuilding..."));
        console.log();
        await install();
        fs.writeFileSync("environment_cache", JSON.stringify(process.env));
        startApp();
    } else {
        console.log();
        console.log(chalk.green("No environment change detected, starting client app..."));
        console.log();
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
    return !isSimilar;
}

function removeDuplicates(array) {
    return array.filter((a, b) => array.indexOf(a) === b) ;
};