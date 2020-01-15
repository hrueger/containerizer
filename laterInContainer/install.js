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
];
const additionalBuilds = [
    {
        dir: "api",
        cmd: "npm run build",
    }
];
const unnecessaryFilesAndDirs = [
    ".github",
    "docs",
    "AGM-Tools",
    "fs",
    ".gitignore",
    "greenkeeper.json",
    "README.txt",
    "api/src",
    "api/package.json",
    "api/package-lock.json",
    "api/tsconfig.json",
    "api/tslint.json",
    "api/.gitignore",
];
const startFile = "api/build/index.js";

/// End of config


const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const {exec} = require("child_process");

main();

function main() {

    const taskz = require("taskz");
 
    const tasks = taskz([
        {
            text: "Cleaning up old artifacs",
            task: async () => {
                await new Promise((resolve, reject) => {
                    if (fs.existsSync(relativeToAbsolute(workingDirPath))) {
                        rimraf(relativeToAbsolute(workingDirPath), (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(err);
                            }
                        });
                    } else {
                        resolve();
                    }
                });
            }
        },
        {
            text: "Creating workspace",
            task: async () => {
                fs.mkdirSync(relativeToAbsolute(workingDirPath));
            }
        },
        {
            text: `Cloning ${repository} using branch ${branch}`,
            task: async () => {
                const simpleGit = require("simple-git/promise")(relativeToAbsolute(workingDirPath));
                await simpleGit.clone(repository, ".", [`-b${branch}`]);
            }
        },
        {
            text: commit ? `Checking out commit ${commit}` : `Checking out latest commit`,
            task: async () => {
                const simpleGit = require("simple-git/promise")(relativeToAbsolute(workingDirPath));
                await simpleGit.checkout(commit);
            }
        },
        { 
            text: "Running \"npm install\"",
            tasks: taskz(npmInstallDirs.map((dir) => {
                    return {
                        text: `in /${dir}`,
                        task: async () => {
                            await execShellCommand("npm install", {cwd: insideWorkDirPath(dir)});
                        }
                    };
                })),
        },
        {
            text: "Creating secret files",
            tasks: taskz(filesToCreate.map((file) => {
                    return {
                        text: `file /${file.path} with template ${file.template}`,
                        task: () => {
                            if (file.template == "typescript") {
                                fs.writeFileSync(insideWorkDirPath(file.path), `export const ${file.rootVariableName} = {${file.presetProperties.map((p) => `${p.key}: ${p.value},`).join("")}${file.properties.map((p) => `${p}: ${process.env[p]},`).join("")}};
                                `);
                            } else {
                                throw new Error(`Template ${file.template} is not supported!`);
                            }
                        }
                    };
                })),
        },
        {
            text: `Building Angular app from ${ngSrcDir} with ${customNgBuildCmd ? "custom" : "standard"} build command ${customNgBuildCmd ? `(${customNgBuildCmd})` : ""}`,
            task: async () => {
                let buildCmd = (customNgBuildCmd ? customNgBuildCmd : `ng build --prod --baseHref / --outputPath ${insideWorkDirPath(ngDestDir)}`);
                await execShellCommand(buildCmd, {cwd: insideWorkDirPath(ngSrcDir)});
            }
        },
        { 
            text: "Running additional builds",
            tasks: taskz(additionalBuilds.map((build) => {
                    return {
                        text: `building /${build.dir} with command ${build.cmd}`,
                        task: async () => {
                            await execShellCommand(build.cmd, {cwd: insideWorkDirPath(build.dir)});
                        }
                    };
                })),
        },
        { 
            text: "Removing unnecessary files and directories",
            tasks: taskz(unnecessaryFilesAndDirs.map((item) => {
                    return {
                        text: `removing /${item}`,
                        task: async () => {
                            await new Promise((resolve, reject) => {
                                rimraf(insideWorkDirPath(item), (err) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve(err);
                                    }
                                });
                            });
                        }
                    };
                })),
        },
        {
            text: "Starting application",
            task: async () => {
                console.log(await execShellCommand(`${relativeToAbsolute(path.join("node_modules", ".bin", "pm2"))} start ${insideWorkDirPath(startFile)} --name app`));
            }
        }
    ]);
    tasks.run().catch((err) => {
        console.error(err);
    });
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