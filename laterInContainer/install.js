/// Start of config

const workingDirPath = "./work"
const repository = "https://github.com/hrueger/AGM-Tools"
const branch = "api-v2"; // master
const commit = ""; // 888c9937ea8fbacc689ae256fd0d7918bc89ac90
const npmInstallDirs = ["AGM-Tools", "api"];
const ngSrcDir = "AGM-Tools";
const ngDestDir = "frontend_build";
const customNgBuildCmd = "";
const filesToCreate = [
    {
        path: "AGM-Tools/src/environments/environment.ts",
        template: "typescript",
        rootVariableName: "environment",
        properties: [
            "apiUrl",
            "appUrl",
            "firebase_apiKey",
            "firebase_appId",
            "firebase_authDomain",
            "firebase_databaseURL",
            "firebase_messagingSenderId",
            "firebase_projectId",
            "firebase_storageBucket"
        ],
        presetProperties: [
            {
                key: "production",
                value: false,
            }
        ]
    },
    {
        path: "AGM-Tools/src/environments/environment.prod.ts",
        template: "typescript",
        rootVariableName: "environment",
        properties: [
            "apiUrl",
            "appUrl",
            "firebase_apiKey",
            "firebase_appId",
            "firebase_authDomain",
            "firebase_databaseURL",
            "firebase_messagingSenderId",
            "firebase_projectId",
            "firebase_storageBucket"
        ],
        presetProperties: [
            {
                key: "production",
                value: true,
            }
        ]
    }
]

/// End of config


const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const {exec} = require('child_process');

main();

async function main() {
    console.log("Creating workspace");
    /*if (fs.existsSync(relativeToAbsolute(workingDirPath))) {
        rimraf.sync(relativeToAbsolute(workingDirPath));
    }
    fs.mkdirSync(relativeToAbsolute(workingDirPath));*/

    console.log(`Cloning ${repository} using branch ${branch}`);
    const simpleGit = require('simple-git/promise')(relativeToAbsolute(workingDirPath));
    // await simpleGit.clone(repository, ".", [`-b${branch}`]);

    if (commit) {
        console.log(`Checking out at commit ${commit}`);
        // await simpleGit.checkout(commit);
    } else {
        console.log(`Checking out at latest commit`);
    }

    for (const dir of npmInstallDirs) {
        console.log(`Running \"npm install\" in /${dir}`);
        // await execShellCommand("npm install", {cwd: insideWorkDirPath(dir)});
    };

    for (const file of filesToCreate) {
        console.log(`Creating /${file.path} with template ${file.template}`);
        if (file.template == "typescript") {
            fs.writeFileSync(insideWorkDirPath(file.path), `export const ${file.rootVariableName} = {${file.presetProperties.map((p) => `${p.key}: ${p.value},`).join("")}${file.properties.map((p) => `${p}: ${process.env[p]},`).join("")}};
            `);
        } else {
            process.exit(1);
        }
    }

    let buildCmd = (customNgBuildCmd ? customNgBuildCmd : `ng build --prod --baseHref / --outputPath ${insideWorkDirPath(ngDestDir)}`);
    console.log(`Building Angular app from ${ngSrcDir} with ${customNgBuildCmd ? "custom" : "standard"} build command ${customBuildCOmmand ? `(${customBuildCommand})` : ""}`);
    await execShellCommand(buildCmd, {cwd: insideWorkDirPath(ngSrcDir)});

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