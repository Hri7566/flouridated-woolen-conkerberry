const MidiPlayer = require('midi-player-js');
const minimist = require('minimist');
const fetch = require('node-fetch');
const EventEmitter = require('events');
const path = require('path');
const youtube = require('youtube-dl-exec');
const { writeFile } = require('fs');
const url = require('url');

const Color = require('./Color');
const { Cursor } = require('./Cursor');
const { CommandGroup, Prefix } = require('./CommandGroup');
const { Database, Item, User, ItemConsumable } = require('./Database');
const { PermissionGroup, Permission } = require('./PermissionGroup');

function getYoutubeLinkFromString(str) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?/;
    return regex.exec(str);
}

function downloadFile(uri, filename, callback) {
    return fetch(uri)
        .then(res => res.body)
        .then(body => {
            writeFile(filename, body, err => {
                if (err) {
                    callback(err);
                } else {
                    callback(null, filename);
                }
            });
        })
        .catch(err => callback(err));
}

function retardify(str) {
    const words = str.split(' ');
    const ret = [];
    for (let i = 0; i < words.length; i++) {
        if (words[i].length > 0) {
            // randomize every letter capitalization
            const word = words[i].split('');
            for (let j = 0; j < word.length; j++) {
                if (Math.random() > 0.5) {
                    word[j] = word[j].toUpperCase();
                } else {
                    word[j] = word[j].toLowerCase();
                }
            }
            ret.push(word.join(''));
        }
    }
    return ret.join(' ');
}

class Bot extends EventEmitter {
    constructor (cl, ch) {
        super();

        this.client = cl;
        this.client.ch = ch;

        this.clients = new Map();

        this.cursor = new Cursor();
        this.c = []; // TODO chat history
        this.player = new MidiPlayer.Player();
        this.keys = require('./keys');

        // this.commands = [];
        // this.bindDefaultCommands();

        this.commandGroups = [];

        let GENERAL_COMMANDS = new CommandGroup('general', 'General commands');
        GENERAL_COMMANDS.addPrefix(new Prefix('g!'));
        GENERAL_COMMANDS.addPrefix(new Prefix('*'));
        GENERAL_COMMANDS.addPrefix(new Prefix('7'));
        GENERAL_COMMANDS.addPrefix(new Prefix('h!'));
        GENERAL_COMMANDS.addPrefix(new Prefix('^'));
        GENERAL_COMMANDS.addPermissionLevel('command.general');
        this.commandGroups.push(GENERAL_COMMANDS);
        this.bindGeneralCommands();

        let FUN_COMMANDS = new CommandGroup('fun', 'Fun commands');
        FUN_COMMANDS.addPrefix(new Prefix('f!'));
        FUN_COMMANDS.addPrefix(new Prefix('*'));
        FUN_COMMANDS.addPrefix(new Prefix('~'));
        FUN_COMMANDS.addPermissionLevel('command.fun');
        this.commandGroups.push(FUN_COMMANDS);
        this.bindFunCommands();

        let MOD_COMMANDS = new CommandGroup('mod', 'Moderator commands');
        MOD_COMMANDS.addPrefix(new Prefix('m!'));
        MOD_COMMANDS.addPrefix(new Prefix('*'));
        MOD_COMMANDS.addPrefix(new Prefix('$'));
        MOD_COMMANDS.addPermissionLevel('mod.command');
        this.commandGroups.push(MOD_COMMANDS);
        this.bindModCommands();

        let ADMIN_COMMANDS = new CommandGroup('admin', 'Admin commands');
        ADMIN_COMMANDS.addPrefix(new Prefix('a!'));
        ADMIN_COMMANDS.addPrefix(new Prefix('*'));
        ADMIN_COMMANDS.addPrefix(new Prefix('&'));
        ADMIN_COMMANDS.addPermissionLevel('admin.command');
        this.commandGroups.push(ADMIN_COMMANDS);
        this.bindAdminCommands();

        this.prefixes = []; // TODO prefixes
        this.bindEventListeners();
        this.startClientIfNotStarted() ? this.bindDefaultClientListeners() : console.log(this.error('WebSocket not supported'));

        this.currentPoll = {
            question: 'Should ModernMPP style be released?',
            options: ['Yes', 'No']
        }

        // database poll count create
        Database.get('poll_yes').then(res => {
           
            Database.set('poll_yes', JSON.stringify([]));
        }, err => {
            Database.set('poll_yes', JSON.stringify([]));
        });

        Database.get('poll_no').then(res => {

            Database.set('poll_no', JSON.stringify([]));
        }, err => {
            Database.set('poll_no', JSON.stringify([]));
        });

        // Database.modifyUser("2ffc3744fbc1bc6c6ef4a330", user => {
        //     User.removePermissionGroup(user, 'admin');
        // });
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

        cl.sendArray([{m:'+custom'}]);

        cl.on('hi', msg => {
            console.log(`Online`);
            cl.setChannel(cl.ch);
            let u = msg.u;
            // if (u.name !== 'fluoridated woolen conkerberry') {
            //     cl.setName('fluoridated woolen conkerberry');
            // }
            // if (u.name !== 'Cereal') {
            //     cl.setName('Cereal');
            // }
            if (u.name !== 'pinkalicious') {
                cl.setName('pinkalicious');
            }
            // if (u.color !== '#fff0b2') {
            //     cl.setColor('#fff0b2');
            // }

            // set color to pinkalicous
            if (u.color !== '#E684AE') {
                cl.setColor('#E684AE');
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
            if (!msg) return;
            if (!msg.a) return;
            if (!msg.p) return;
            if (!msg.p._id) return;
            if (!msg.p.name) return;
            if (typeof msg.a !== 'string') return;
            if (msg.a.length < 1) return;

            msg.args = msg.a.split(' ');

            Database.getUser(msg.p._id, (err, user) => {
                if (err) {
                    // console.error(err);
                }
                if (user == null || typeof user === 'undefined') {
                    // console.log('user is null');
                    Database.createUser(msg.p).then(value => {
                        console.log(`Created user ${value.name}`);
                    }, reason => {
                        console.error(reason);
                    });
                } else {
                    Database.upgradeUser(user);
                }
                
                msg.user = user;
                let found = false;
                
                cmdgpLoop:
                for (let cmdgp of this.commandGroups) {
                    prefixLoop:
                    for (let prefix of cmdgp.prefixes) {
                        let hasPermission = false;
                        permLoop:
                        for (let perm of cmdgp.permissionLevels) {
                            if (User.hasPermission(msg.user, perm)) {
                                hasPermission = true;
                                break permLoop;
                            }
                        }
                        // console.log('hasPermission: ', hasPermission);
                        if (!hasPermission) continue prefixLoop;
                        if (msg.args[0].startsWith(prefix.prefix)) {
                            msg.cmd = msg.args[0].substr(prefix.prefix.length);
                            msg.prefix = prefix;
                            msg.cmdGroup = cmdgp;
                            found = true;
                            break cmdgpLoop;
                        }
                    }
                }
                
                if (!found) return;
                msg.argv = minimist(msg.args);
                msg.argcat = msg.a.substr(msg.args[0].length).trim();
                this.emit('command_input', msg, cl);
            });
        });

        cl.on('a', msg => {
            // this.c.push(msg);

            let ytlink = getYoutubeLinkFromString(msg.a);
            if (typeof ytlink == 'undefined') return;
            if (ytlink == null) return;
        });

        // cl.on('c', msg => {
        //     this.c = msg.c;
        // });

        cl.on('custom', cu => {
            let msg = cu.data;
            
            switch (msg.m) {
                case 'crown':
                    cl.sendArray([{m:'chown', id: cu.p}]);
            }
        });
    }

    bindEventListeners() {
        this.on('command_input', (msg, cl) => {
            for (let group of this.commandGroups) {
                if (!group.hasPrefix(msg.prefix.prefix)) continue;
                group.getAvailableCommands().forEach(command => {
                    if (group.commandIsDisabled(command)) cl.sendChat(`Command '${command.acc[0]}' is disabled.`);
                    command.acc.forEach(a => {
                        if (msg.cmd == a) {
                            let out = command.cb(msg, this, cl);
                            if (typeof out == 'undefined' || out == '') return;
                            cl.sendChat(out);
                        }
                    });
                });
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
            if (evt.velocity < 10) return;
            if (evt.name == "Note off" || (evt.name == "Note on" && evt.velocity === 0)) {
                this.client.stopNote(this.keys[evt.noteName]);
            } else if (evt.name == "Note on") {
                this.client.startNote(this.keys[evt.noteName], evt.velocity / 100);
            } else if (evt.name == "Set Tempo") {
                this.player.tempo = evt.data;
            }
        });
    }

    bindGeneralCommands() {
        let gp = this.commandGroups.find(g => g.id === 'general');
        
        gp.addCommand(new Command(['help', 'cmds', 'h'], '$PREFIXhelp (command)', 0, (msg, bot, cl) => {
            this.commandGroups.forEach(group => {
                let hasPermission = false;
                group.permissionLevels.forEach(perm => {
                    if (User.hasPermission(msg.user, perm)) {
                        hasPermission = true;
                        return;
                    }
                });
                // console.log('hasPermission: ', hasPermission);
                // console.log('group.id: ', group.id);
                if (!hasPermission) return;
                let cmds = group.availableCommands.map(cmd => {
                    if (!group.commandIsDisabled(cmd) && !cmd.hidden) return `${group.prefixes[0].prefix}${cmd.acc[0]}`;
                }).filter(cmd => cmd);
                
                cl.sendChat(`${group.name}: ${cmds.join(', ')}`);
            });
        }));

        gp.addCommand(new Command(['color', 'c'], '$PREFIXcolor (color)', 0, msg => {
            let col = msg.argv._.slice(1, msg.argv._.length).join(' ')
            if (!msg.args[1]) col = msg.p.color;
            let color = new Color(col); // TODO color command: ability to do color math?
            if (msg.argv.verbose || msg.argv.v) {
                let verbose = ` [${color.toHexa()}] (${color.r} ${color.g} ${color.b})`;
                return `${color.getName()} ${verbose}`
            } else {
                return `${color.getName()}`;
            }
        }));

        gp.addCommand(new Command(['id'], '$PREFIXid', 0, msg => {
            return `${msg.p.name}'s ID: ${msg.p._id}`;
        }));

        gp.addCommand(new Command(['argcat'], '$PREFIXargcat', 1, msg => {
            let args = msg.argv._.join(' ');
            delete msg.argv._;
            let keyvals = "";
            for (let key of Object.keys(msg.argv)) {
                keyvals += `${key}: ${msg.argv[key]} | `;
            }
            keyvals = keyvals.substr(0, keyvals.length - 2).trim();
            return `argv: ${args} | opt: ${keyvals}`;
        }, true));

        gp.addCommand(new Command(['poll'],'$PREFIXpoll (yes/no)', 0, (msg, bot, cl) => {
            if (!msg.args[1]) {
                Database.get('poll_yes').then(yes => {
                    Database.get('poll_no').then(no => {
                        cl.sendChat(`Poll: ${this.currentPoll.question} | ${this.currentPoll.options[0]}: ${JSON.parse(yes).length} / ${this.currentPoll.options[1]}: ${JSON.parse(no).length}`);
                    });
                });
            } else {
                if (this.currentPoll.options[0].toLowerCase().includes(msg.args[1].toLowerCase())) {
                    Database.get('poll_yes').then(yes => {
                        let arr = JSON.parse(yes);
                        if (arr.indexOf(msg.p._id) !== -1) arr.push(msg.p._id);
                        Database.set('poll_yes', JSON.stringify(arr));
                        cl.sendChat(`Your answer (${this.currentPoll.options[0]}) was counted.`);
                    });
                } else if (this.currentPoll.options[1].toLowerCase().includes(msg.args[1].toLowerCase())) {
                    Database.get('poll_no').then(no => {
                        let arr = JSON.parse(no);
                        if (arr.indexOf(msg.p._id) !== -1) arr.push(msg.p._id);
                        Database.set('poll_no', JSON.stringify(arr));
                        cl.sendChat(`Your answer (${this.currentPoll.options[1]}) was counted.`);
                    });
                }
            }
        }));

        gp.addCommand(new Command(['data'], '$PREFIXdata', 0, msg => {
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

        gp.addCommand(new Command(['info'], '$PREFIXinfo', 0, msg => {
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

        gp.addCommand(new Command(['giveitemthatnobodyseesyet'], '$PREFIXgiveitemthatnobodyseesyet', 0, msg => {
            Database.addItem(msg.user._id, new ItemConsumable('healthPotion', 'Health Potion', 'A potion that restores health', 10, 1, 'consumable_hp', 10, 5));
        }, true));

        gp.addCommand(new Command(['inventory', 'inv'], '$PREFIXinventory', 0, msg => {
            let inv = msg.user.inventory;
            let out = `${msg.user.name}'s Inventory: `;
            let startLength = out.length;
            for (let key of Object.keys(inv)) {
                // out += `${key}: `;
                for (let i of inv[key]) {
                    if (i.count > 1) {
                        out += `${i.name} (x${i.count}) | `;
                    } else {
                        out += `${i.name} | `;
                    }
                }
            }
            // remove last |
            if (out.length > startLength) out = out.substring(0, out.length - 2);
            if (out.length <= startLength) {
                out += "(Empty)";
            }
            return out;
        }, true));

        gp.disableCommand(gp.getCommandByName('inventory'));

        gp.addCommand(new Command(['status', 'stats', 'stat', 'st'], '$PREFIXstatus', 0, msg => {
            let user = msg.user;
            if (msg.args[1]) {
                user = Object.values(cl.ppl).find(p => p.name.toLowerCase().includes(msg.argcat.toLowerCase()) || p._id.toLowerCase().includes(msg.argcat.toLowerCase()));
                if (!user) return `User ${msg.args[1]} not found`;
            }
            let out = `${msg.user.name}'s Stats: `;
            for (let stat of Object.keys(user)) {
                out += `${stat}: ${user[stat]} | `;
            }
            return out;
        }, true));
        
        gp.addCommand(new Command(['time'], '$PREFIXtime', 0, msg => {
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

        gp.addCommand(new Command(['about'], '$PREFIXabout', 0, msg => {
            return `This bot was made by Hri7566#3409.`;
        }));

        gp.addCommand(new Command(['say'], '$PREFIXsay (message)', 1, msg => {
            let str = msg.argv._.join(' ').substr(msg.argv._[0].length).trim();
            
            if (msg.argv.spooky1) {
                str = str.replace(/[aeiou]/gi, 'o');
            }

            if (msg.argv.capital || msg.argv.uppercase) {
                str = str.toUpperCase();
            }

            if (msg.argv.lowercase) {
                str = str.toLowerCase();
            }

            return `${str}`;
        }));
    }

    bindFunCommands() {
        let gp = this.commandGroups.find(g => g.id === 'fun');

        gp.addCommand(new Command(['kill'], `$PREFIXkill (user)`, 1, (msg, bot, cl) => {
            let user = Object.values(cl.ppl).find(p => p.name.toLowerCase().includes(msg.argcat.toLowerCase()) || p._id.toLowerCase().includes(msg.argcat.toLowerCase()));
            if (!user) return `User '${msg.argcat}' not found.`;
            
            let kill = Math.floor(Math.random() * (5 - 1 + 1)) + 1;
            if (kill == 1) {
                return `${msg.p.name} tried to kill ${user.name}, but friend ${msg.p.name} missed by a few burritos.`;
            } else if (kill == 2) {
                return `${user.name} was killed by ${msg.p.name} by boiling them in chili.`;
            } else if (kill == 3) {
                return `${user.name} was killed by ${msg.p.name}. Hopefully, they will never steal the cookies again.`;
            } else if (kill == 4) {
                return `By sheer luck, ${user.name} had a heart attack thinking about ducks and ${msg.p.name} didn't have to get involved.`;
            } else if (kill == 5) {
                return `${msg.p.name} threw ${user.name} into the fire. Now we'll all be warm.`;
            }
        }));

        gp.addCommand(new Command(['slap'], '$PREFIXslap (user)', 1, (msg, bot, cl) => {
            let user = Object.values(cl.ppl).find(p => p.name.toLowerCase().includes(msg.argcat.toLowerCase()) || p._id.toLowerCase().includes(msg.argcat.toLowerCase()));
            if (!user) return `User '${msg.argcat}' not found.`;
            let slap = Math.floor(Math.random() * (5 - 1 + 1)) + 1;
            if (slap == 1) {
                return `${msg.p.name} tried to slap ${user.name}, but friend ${msg.p.name} missed by a few burritos.`;
            } else if (slap == 2) {
                return `${user.name} was slapped by ${msg.p.name} and it left a mark.`;
            } else if (slap == 3) {
                return `${user.name} was slapped by ${msg.p.name} and it left a bruise.`;
            } else if (slap == 4) {
                return `${user.name} was slapped by ${msg.p.name} so hard, it left a scar.`;
            } else if (slap == 5) {
                return `${user.name} was slapped by ${msg.p.name} and they flew across the room.`;
            }
            return `${msg.p.name} slapped ${user.name}`;
        }));

        gp.addCommand(new Command(['arrest'], '$PREFIXarrest (user)', 1, (msg, bot, cl) => {
            return `${msg.argcat}, I'm arresting you because I can. Anything you say can and will be used against you in a court of law. This means that what they say can become evidence in a trial against them. There are other rights that the police usually read after that: You have the right to an attorney.`;
        }, true));

        gp.addCommand(new Command(['retardify'], '$PREFIXretardify (text)', 1, (msg, bot, cl) => {
            return `${retardify(msg.argcat)}`;
        }));

        gp.addCommand(new Command(['reverse'], '$PREFIXreverse (text)', 1, (msg, bot, cl) => {
            return `${msg.argcat.split('').reverse().join('')}`;
        }));

        gp.addCommand(new Command(['shrug'], '$PREFIXshrug', 0, (msg, bot, cl) => {
            return `¯\\_(ツ)_/¯`;
        }));

        gp.addCommand(new Command(['tableflip'], '$PREFIXtableflip', 0, (msg, bot, cl) => {
            return `(╯°□°）╯︵ ┻━┻`;
        }));

        gp.addCommand(new Command(['tableunflip'], '$PREFIXtableunflip', 0, (msg, bot, cl) => {
            return `┬─┬ ノ( ゜-゜ノ)`;
        }, true));

        gp.addCommand(new Command(['coinflip'], '$PREFIXcoinflip', 0, (msg, bot, cl) => {
            let coin = Math.floor(Math.random() * (2 - 1 + 1)) + 1;
            if (coin == 1) {
                return `Heads`;
            } else {
                return `Tails`;
            }
        }));

        gp.addCommand(new Command(['fuck'], '$PREFIXfuck (user)', 1, (msg, bot, cl) => {
            let user = Object.values(cl.ppl).find(p => p.name.toLowerCase().includes(msg.argcat.toLowerCase()) || p._id.toLowerCase().includes(msg.argcat.toLowerCase()));
            if (!user) return `User '${msg.argcat}' not found.`;
            let fuck = Math.floor(Math.random() * (5 - 1 + 1)) + 1;
            if (fuck == 1) {
                return `${msg.p.name} tried to fuck ${user.name}, but friend ${msg.p.name} missed by a few burritos.`;
            } else if (fuck == 2) {
                return `${user.name} was fucked by ${msg.p.name} right in the ass.`;
            } else if (fuck == 3) {
                return `${user.name} was fucked by ${msg.p.name}. Hopefully, they will never steal the cookies again.`;
            } else if (fuck == 4) {
                return `${msg.p.name} fucked ${user.name} in the face. They are now blind and deaf.`;
            } else if (fuck == 5) {
                return `${msg.p.name} fucked ${user.name}. You are now dead. Please take your receipt.`;
            }
        }, true));
    }

    bindModCommands() {
        let gp = this.commandGroups.find(g => g.id === 'mod');

        gp.addCommand(new Command(['play'], '$PREFIXplay (song)', 1, msg => {
            try {
                if (!msg.argcat.endsWith('.mid')) msg.argcat += '.mid';
                this.client.sendChat(`Playing '${msg.argcat}'...`);
                this.player.loadFile(path.join(__appdir, "midis", msg.argcat));
            } catch (err) {
                console.error(err);
                return `Error playing ${msg.argcat}`;
            }
        }));

        gp.addCommand(new Command(['stop'], '$PREFIXstop (song)', 0, msg => {
            this.player.stop();
            return `Stopped playing.`;
        }));
    }

    bindAdminCommands() {
        let gp = this.commandGroups.find(g => g.id === 'admin');

        gp.addCommand(new Command(['download'], '$PREFIXdownload (song)', 0, msg => {
            // TODO fix and test download
            try {
                let u = new url.URL(msg.argcat);
                let filename = u.pathname.split('/').reverse()[0];
                if (!filename.endsWith('.mid')) filename = filename + '.mid';
                this.client.sendChat(`Downloading '${filename}'...`);
                fetch(msg.argcat).then(x => {
                    x.arrayBuffer();
                }).then(x => {
                    downloadFile(x, path.join(__appdir, "midis", filename), () => {
                        this.client.sendChat(`Downloaded '${filename}'!`);
                    });
                    // if (x[0] == 'M' && x[1] == 'T' && x[2] == 'h' && x[3] == 'd') {
                    //     writeFile(path.join(__appdir, 'midis', filename), x);
                    //     this.client.sendChat(`Download of '${msg.argcat}' finished and saved as '${filename}'.`);
                    // } else {
                    //     this.client.sendChat(`Download of '${msg.argcat}' failed because the file has no MIDI header.`);
                    // }
                });
            } catch (err) {
                return `Download of '${msg.argcat}' failed.`;
            }
        }, true));

        gp.addCommand(new Command(['permissiongroups', 'groups'], '$PREFIXpermissiongroups', 0, msg => {
            let groups = [];
            for (let group of msg.user.permissionGroups) {
                groups.push(PermissionGroup.findGroup(group).displayName);
            }
            groups = groups.join(', ');
            return `Your permission groups: ${groups ? groups : "(None)"}`;
        }));

        gp.addCommand(new Command(['permtest'], '$PREFIXpermtest (permission)', 1, msg => {
            return User.hasPermission(msg.user, msg.argv._[0]) ? true : false;
        }, true));

        gp.addCommand(new Command(['checkperm'], '$PREFIXcheckperm (permission)', 2, msg => {
            if (!msg.args[1]) return `Usage: ${msg.argv._[0]} (permission) (permission)`;
            return Permission.checkPermission(msg.args[1], msg.args[2]) == true ? true : false;
        }, true));


        gp.addCommand(new Command(['js'], '$PREFIXjs (code)', 1, msg => {
            try {
                let result = eval(msg.argcat);
                return '✅ ' + result;
            } catch (err) {
                return '❌ ' + err;
            }
        }));
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
