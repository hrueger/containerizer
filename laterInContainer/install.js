/// Start of config

const workingDirPath = "./work"
const repository = "https://github.com/hrueger/AGM-Tools"
const branch = "api-v2"; // master
const commit = ""; // 888c9937ea8fbacc689ae256fd0d7918bc89ac90
const npmInstallDirs = ["AGM-Tools", "api"];

/// End of config


const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const {exec} = require('child_process');

main();

async function main() {
    console.log("Creating workspace");
    if (fs.existsSync(relativeToAbsolute(workingDirPath))) {
        rimraf.sync(relativeToAbsolute(workingDirPath));
    }
    fs.mkdirSync(relativeToAbsolute(workingDirPath));

    console.log(`Cloning ${repository} using branch ${branch}`);
    const simpleGit = require('simple-git/promise')(relativeToAbsolute(workingDirPath));
    await simpleGit.clone(repository, ".", [`-b${branch}`]);

    if (commit) {
        console.log(`Checking out at commit ${commit}`);
        await simpleGit.checkout(commit);
    } else {
        console.log(`Checking out at latest commit`);
    }

    for (const dir of npmInstallDirs) {
        console.log(`Running \"npm install\" in /${dir}`);
        await execShellCommand("npm install", {cwd: insideWorkDirPath(dir)});
    };

    console.log("Finished!");
}


// Helpers

function relativeToAbsolute(p) {
    return path.join(__dirname, p);
}

function insideWorkDirPath(p) {
    return path.join(relativeToAbsolute(workingDirPath), p);
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