class Prefix {
    constructor (prefix) {
        this.prefix = prefix;
        this.enabled = true;
        this.hidden = false;
    }

    disable() {
        this.enabled = false;
    }

    enable() {
        this.enabled = true;
    }

    hide() {
        this.hidden = true;
    }

    show() {
        this.hidden = false;
    }
}

class CommandGroup {
    constructor(id, name, commands) {
        this.id = id;
        this.name = name;
        this.availableCommands = commands || [];
        this.disabledCommands = [];
        this.prefixes = [];
        this.permissionLevels = [];
        this.usesPermissions = false;
    }

    addPrefix(prefix) {
        if (typeof prefix === 'string') {
            prefix = new Prefix(prefix);
        }
        this.prefixes.push(prefix);
    }

    hasPrefix(prefix) {
        if (typeof prefix === 'string') {
            return typeof this.prefixes.find(p => p.prefix === prefix) !== 'undefined';
        } else {
            return this.prefixes.includes(prefix);
        }
    }

    disableCommand(cmd) {
        this.disabledCommands.push(cmd);
    }

    commandIsDisabled(cmd) {
        return this.disabledCommands.includes(cmd);
    }

    getAvailableCommands() {
        let cmds = [];
        this.availableCommands.forEach(cmd => {
            if (!this.commandIsDisabled(cmd)) {
                cmds.push(cmd);
            }
        });
        return cmds;
    }

    addCommand(cmd) {
        this.availableCommands.push(cmd);
    }

    removeCommand(cmd) {
        this.availableCommands = this.availableCommands.filter(c => c !== cmd);
    }

    hasCommand(cmd) {
        return this.availableCommands.includes(cmd);
    }

    getCommandByName(cmd) {
        return this.availableCommands.find(c => c.acc[0] === cmd);
    }

    forEachCommand(callback) {
        this.availableCommands.forEach(callback);
    }

    forEachEnabledCommand(callback) {
        this.availableCommands.forEach(cmd => {
            if (!this.commandIsDisabled(cmd)) {
                callback(cmd);
            }
        });
    }

    forEachDisabledCommand(callback) {
        this.availableCommands.forEach(cmd => {
            if (this.commandIsDisabled(cmd)) {
                callback(cmd);
            }
        });
    }

    addPermissionLevel(level) {
        if (!this.usesPermissions) this.usesPermissions = true;
        this.permissionLevels.push(level);
    }
}

module.exports = {
    CommandGroup,
    Prefix
}
