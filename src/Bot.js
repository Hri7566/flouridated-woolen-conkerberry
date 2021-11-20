const MidiPlayer = require('midi-player-js');
const minimist = require('minimist');
const fetch = require('node-fetch');
const EventEmitter = require('events');
const path = require('path');

const Color = require('./Color');
const { Cursor } = require('./Cursor');
const { writeFile } = require('fs');
const url = require('url');

/**
 * TODO command group idea? {prefix: '!', commands: []}
 * TODO database for user data and ranks
 */

class Bot extends EventEmitter {
    constructor (cl, ch) {
        super();

        this.client = cl;
        this.client.ch = ch;

        this.cursor = new Cursor();
        this.c = []; // TODO chat history
        this.player = new MidiPlayer.Player();
        this.keys = require('./keys');

        this.commands = [];
        this.bindDefaultCommands();

        this.prefixes = []; // TODO prefixes
        this.defaultPrefix = '*';
        this.bindEventListeners();
        this.startClientIfNotStarted() ? this.bindDefaultClientListeners() : console.log(this.error('WebSocket not supported'));
    }

    startClientIfNotStarted() {
        if (!this.client.isConnected() && this.client.isSupported()) {
            this.client.start();
            return true;
        }
        return false;
    }
    
    // ANCHOR default listeners and objects
    bindDefaultClientListeners() {
        let cl = this.client;

        cl.sendChat = str => {
            cl.sendArray([{m:'a', message:`\u034f${str}`}]);
        }

        cl.on('hi', msg => {
            console.log(`Online`);
            cl.setChannel(cl.ch);
            let u = msg.u;
            if (u.name !== 'fluoridated woolen conkerberry') {
                cl.setName('fluoridated woolen conkerberry');
            }
            if (u.color !== '#fff0b2') {
                cl.setColor('#fff0b2');
            }
        });

        cl.on("ch", msg => {
            if (!msg.ch.crown) return;
            let time = Date.now() - msg.ch.crown.time + 16000;

            setTimeout(() => {
                cl.sendArray([{m:"chown", id: cl.getOwnParticipant().id}]);
            }, time);
        });

        cl.ws.on('error', (err) => {
            this.error(err);
        });

        cl.on('a', msg => {
            if (typeof msg.a !== 'string') return;
            if (!msg.p) return;
            console.log(msg.p.name + ":", msg.a);

            msg.args = msg.a.split(' ');
            msg.argv = minimist(msg.args);

            msg.argcat = msg.argv._.slice(1, msg.argv._.length).join(' ');
            if (!msg.argv) return;
            if (!msg.argv._) return;
            if (typeof msg.argv._[0] !== 'string') return;
            msg.cmd = msg.argv._[0].split(this.defaultPrefix).join(''); // checkable command string with no prefix on it

            this.emit('command_input', msg);

            this.c.push(msg);
        });

        cl.on('c', msg => {
            this.c = msg.c;
        });
    }

    bindDefaultCommands() {
        this.addCommand(new Command(['help', 'cmds', 'h'], '$PREFIXhelp (command)', 0, msg => {
            // TODO help command and usage info
            let out = "Commands: ";
            for (let cmd of this.commands) {
                if (!cmd.hidden) {
                    out += `${this.defaultPrefix}${cmd.acc[0]} | `;
                }
            }
            out = out.substr(0, out.trim().length - 1).trim();
            return out;
        }));

        this.addCommand(new Command(['color', 'c'], '$PREFIXcolor (color)', 0, msg => {
            let color = new Color(msg.argv._.slice(1, msg.argv._.length).join(' ')); // TODO color command: ability to do color math?
            if (msg.argv.verbose || msg.argv.v) {
                let verbose = ` [${color.toHexa()}] (${color.r} ${color.g} ${color.b})`;
                return `${color.getName()} ${verbose}`
            } else {
                return `${color.getName()}`;
            }
        }));

        this.addCommand(new Command(['argcat'], '$PREFIXargcat', 1, msg => {
            let args = msg.argv._.join(' ');
            delete msg.argv._;
            let keyvals = "";
            for (let key of Object.keys(msg.argv)) {
                keyvals += `${key}: ${msg.argv[key]} | `;
            }
            keyvals = keyvals.substr(0, keyvals.length - 2).trim();
            return `argv: ${args} | opt: ${keyvals}`;
        }, true));

        this.addCommand(new Command(['data'], '$PREFIXdata', 0, msg => {
            let out = `${msg.p._id}: { `;
            for (let key of Object.keys(msg)) {
                if (typeof(msg[key]) == 'object') {
                    out += `${key}: { `
                    for (let k of Object.keys(msg[key])) {
                        out += `${k}: ${msg[key][k]}, `;
                    }
                    out += ` }, `;
                } else {
                    out += `${key}: ${msg[key]}, `;
                }
            }
            out = out.substr(0, out.trim().length - 1).trim() + " }";
            return out;
        }, true));

        this.addCommand(new Command(['info'], '$PREFIXinfo', 0, msg => {
            let pkg = require('../package.json');
            let pkginfo = `${pkg.name} v${pkg.version}`;
            let node = `Node ${process.version}`;
            if (msg.argv.node || msg.argv.n) {
                return `Using ${node}`;
            }
            if (msg.argv.pkginfo || msg.argv.p) {
                return `Using ${pkginfo}`;
            }
            return `Bot package: ${pkginfo} | Running on ${node}`;
        }));
        
        this.addCommand(new Command(['time'], '$PREFIXtime', 0, msg => {
            // TODO timezone options
            function calcTime(city, offset) {
                // create Date object for current location
                var d = new Date();
            
                // convert to msec
                // subtract local time zone offset
                // get UTC time in msec
                var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
            
                // create new Date object for different city
                // using supplied offset
                var nd = new Date(utc + (3600000*offset));
            
                // return time as a string
                return nd.toLocaleString();
            }

            // if (msg.argv.city) {
            //     try {
            //         return `Date & Time in ${msg.argv.city}: ${calcTime(msg.argv.city)}`;
            //     } catch (err) {
                    
            //     }
            // }

            return `Date & Time: ${new Date().toLocaleString()}`;
        }));

        // TODO fix play and stop so retards don't fuck with it
        this.addCommand(new Command(['play'], '$PREFIXplay (song)', 1, msg => {
            try {
                if (!msg.argcat.endsWith('.mid')) msg.argcat += '.mid';
                this.client.sendChat(`Playing '${msg.argcat}'...`);
                this.player.loadFile(path.join(__appdir, "midis", msg.argcat));
            } catch (err) {
                console.error(err);
                return `Error playing ${msg.argcat}`;
            }
        }, true));

        this.addCommand(new Command(['stop'], '$PREFIXstop (song)', 0, msg => {
            this.player.stop();
            return `Stopped playing.`;
        }, true));

        this.addCommand(new Command(['download'], '$PREFIXdownload (song)', 0, msg => {
            try {
                let u = new url.URL(msg.argcat);
                let filename = u.pathname.split('/').reverse()[0];
                if (!filename.endsWith('.mid')) filename = filename + '.mid';
                this.client.sendChat(`Downloading '${filename}'...`);
                fetch(msg.argcat).then(x => {
                    x.arrayBuffer();
                }).then(x => {
                    if (x[0] == 'M' && x[1] == 'T' && x[2] == 'h' && x[3] == 'd') {
                        writeFile(path.join(__appdir, 'midis', filename), x);
                        this.client.sendChat(`Download of '${msg.argcat}' finished and saved as '${filename}'.`);
                    } else {
                        this.client.sendChat(`Download of '${msg.argcat}' failed because the file has no MIDI header.`);
                    }
                });
            } catch (err) {
                return `Download of '${msg.argcat}' failed.`;
            }
        }, true));
    }

    bindEventListeners() {
        this.on('command_input', msg => {
            if (!msg.argv._[0].startsWith(this.defaultPrefix)) return;

            // ANCHOR command loop
            for (let cmd of this.commands) { //? should i use foreach instead?
                // check if the entered command is this current command based on the list of accessors of the current command
                let enteredCommand = false;
                
                cmd.acc.forEach(acc => {
                    if (msg.cmd == acc) enteredCommand = true;
                });

                if (!enteredCommand) continue;

                if (msg.argv._.length - 1 < cmd.minargs) { // check user's arguments against command's minimum required arguments
                    this.client.sendChat('😬 not enough arguments');
                    break;
                }

                // TODO user permission scheme (AFTER user data)

                try {
                    let out = cmd.cb(msg, this); // run command

                    if (typeof out !== 'undefined' && out !== '') { // check if command output is nothing
                        this.client.sendChat(out);
                    }
                } catch (err) {
                    console.error(err);
                    this.client.sendChat(`big uh oh! don't do that again please`);
                }
            }
        });

        this.player.on('fileLoaded', () => {
            setTimeout(() => {
                this.player.sampleRate = 0;
                this.player.play();
            }, 5000);
        });

        this.player.on('midiEvent', evt => {
            if (evt.channel == 10) return;
            if (evt.name == "Note off" || (evt.name == "Note on" && evt.velocity === 0)) {
                this.client.stopNote(this.keys[evt.noteName]);
            } else if (evt.name == "Note on") {
                this.client.startNote(this.keys[evt.noteName], evt.velocity / 100);
            } else if (evt.name == "Set Tempo") {
                this.player.tempo = evt.data;
            }
        });
    }

    addCommand(cmd) {
        this.commands.push(cmd);
    }

    getPublicData() {
        return {
            u: this.client.getOwnParticipant(),
            ppl: this.client.ppl
        }
    }

    getCursorData() {
        return this.cursor;
    }

    error(...args) {
        args.forEach(arg => console.error(`Bot error: ${arg}`));
    }
}

class Command {
    constructor (acc, usage, minargs, cb, hidden) {
        this.acc = acc; // list of accessors
        this.usage = usage; // command usage
        // TODO command descriptions
        this.minargs = minargs; // minimum required arguments
        this.cb = cb; // callback
        this.hidden = hidden || false;
    }

    getUsage(prefix) {
        if (prefix) return this.usage.split('$PREFIX').join(prefix);
        return this.usage.split('$PREFIX').join(this.defaultPrefix);
    }
}

module.exports = {
    Bot,
    Command
}
