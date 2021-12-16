// import leveldb
const leveldb = require('level');
const { PermissionGroup, Permission } = require('./PermissionGroup');

// import db
const db = leveldb(__appdir + '/data');

class Database {
    static set(key, value) {
        return new Promise((resolve, reject) => {
            db.put(key, value, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    static get(key) {
        return new Promise((resolve, reject) => {
            db.get(key, (err, value) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(value);
                }
            });
        });
    }

    static remove(key) {
        return new Promise((resolve, reject) => {
            db.del(key, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    static clear() {
        return new Promise((resolve, reject) => {
            db.clear((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    static createUser(p) {
        return new Promise((resolve, reject) => {
            db.createReadStream()
                .on('data', (data) => {
                    if (data.key === p._id) {
                        reject('user already exists');
                    }
                })
                .on('end', () => {
                    let user = new User(p);
                    db.put(p._id, JSON.stringify(user), (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(user);
                        }
                    });
                });
        });
    }

    static getUser(_id, cb) {
        db.get(_id, (err, value) => {
            if (err) {
                return cb(err);
            }
            if (value) {
                return cb(null, JSON.parse(value));
            } else {
                return cb(null, null);
            }
        });
    }

    static createUserInventory(p) {
        p.inventory = {};
        Database.set(p._id, JSON.stringify(p));
    }

    static modifyUser(_id, cb) {
        Database.get(_id)
            .then((user) => {
                user = JSON.parse(user);
                cb(user);
                Database.set(user._id, JSON.stringify(user));
            })
            .catch((err) => {
                // console.log(err);
            });
    }

    static setUserFlag(_id, key, value) {
        Database.get(_id)
            .then((user) => {
                user = JSON.parse(user);
                user.flags[key] = value;
                Database.set(_id, JSON.stringify(user));
            })
            .catch((err) => {
                // console.log(err);
            });
    }

    static addItem(_id, item) {
        Database.modifyUser(_id, (user) => {
            if (!user.inventory[item.type]) {
                user.inventory[item.type] = [];
            }

            user.inventory[item.type].push(item);

            console.log(user.inventory);
        });
    }

    static upgradeUser(user) {
        Database.modifyUser(user._id, (u) => {
            u.name = user.name;
            User.upgrade(u);
        });
    }

    static formatBalance(bal) {
        return `$${bal.toFixed(2)}`;
    }
}

class User {
    constructor(p) {
        this._id = p._id;
        this.name = p.name;
        this.inventory = {};
        this.flags = {};
        this.health = 100;
        this.maxHealth = 100;
        this.mana = 100;
        this.maxMana = 100;
        this.armor = new Armor();
        this.balance = 0;
        this.permissionGroups = [];
    }

    static DEFAULT_GROUPS = [
        'user'
    ];

    // add new properties to old users
    static upgrade(user) {
        user.flags = user.flags ? user.flags : {};
        user.health = user.health ? user.health : 100;
        user.maxHealth = user.maxHealth ? user.maxHealth : 100;
        user.mana = user.mana ? user.mana : 100;
        user.maxMana = user.maxMana ? user.maxMana : 100;
        user.armor = user.armor ? user.armor : new Armor();
        user.balance = user.balance ? user.balance : 0;
        if (typeof user.permissionGroups !== 'object') {
            user.permissionGroups = [];
        }
        user.permissionGroups = user.permissionGroups ? user.permissionGroups : [];

        for (let group of User.DEFAULT_GROUPS) {
            if (user.permissionGroups.indexOf(group) == -1) {
                user.permissionGroups.push(group);
            }
        }

        if (Array.isArray(user.inventory)) user.inventory = {};
    }

    static addPermissionGroup(user, group) {
        if (typeof group == 'object') {
            group = group.id;
        }
        Database.modifyUser(user._id, (u) => {
            if (u.permissionGroups.indexOf(group) == -1) {
                u.permissionGroups.push(group);
            }
        });
    }

    static removePermissionGroup(user, group) {
        if (typeof group == 'object') {
            group = group.id;
        }
        Database.modifyUser(user._id, (u) => {
            let index = user.permissionGroups.indexOf(group);
            if (index != -1) {
                u.permissionGroups.splice(index, 1);
            }
        });
    }

    static removeDuplicatePermissionGroups(user) {
        Database.modifyUser(user._id, (u) => {
            u.permissionGroups = user.permissionGroups.filter((v, i, a) => a.indexOf(v) === i);
        });
    }

    static hasPermission(user, permission) {
        if (!user) return;
        let out = false;
        if (typeof user.permissionGroups !== 'object') {
            user.permissionGroups = [];
        }
        for (let pg of user.permissionGroups) {
            let group = PermissionGroup.findGroup(pg);
            if (group.hasPermission(permission)) {
                out = true;
            }
        }
        return out;
    }
}

class Armor {
    constructor() {
        this.head = new Item();
        this.chest = new Item();
        this.legs = new Item();
        this.feet = new Item();
        this.hands = new Item();
        this.mainHand = new Item();
        this.offHand = new Item();
    }
}

class Item {
    constructor(id, name, description, value, weight, type, amount) {
        this.id = id || 'none';
        this.name = name || 'none';
        this.description = description || 'none';
        this.value = value || 0;
        this.weight = weight || 0;
        this.type = type || 'none';
        this.amount = amount | 1;
    }

    static useItem(user, item) {
        let additionalEffectText = '';

        if (item.type === 'consumable_hp') {
            user.health += item.value;
            if (user.health > user.maxHealth) {
                user.health = user.maxHealth;
            }

            additionalEffectText = `${user.name} feels better!`;
        }

        if (item.type === 'consumable_mp') {
            user.mana += item.value;
            if (user.mana > user.maxMana) {
                user.mana = user.maxMana;
            }

            additionalEffectText = `${user.name} feels refreshed!`;
        }

        if (item.type === 'weapon') {
            user.weapon = item;
            return `${user.name} now wields the ${item.name}.`;
        }

        if (item.type === 'armor') {
            user.armor = item;
            additionalEffectText = `${user.name} now wears the ${item.name}.`;
        }

        if (item.type === 'consumable') {
            return `${user.name} consumes ${item.name}. ${additionalEffectText}`;
        } else {
            return `${user.name} uses ${item.name}. ${additionalEffectText}`;
        }
    }
}

class ItemConsumable extends Item {
    constructor(id, name, description, value, weight, type, effect, duration) {
        super(id, name, description, value, weight, type);
        this.effect = effect;
        this.duration = duration;
    }
}

class ItemEquipment extends Item {
    constructor(id, name, description, value, weight, type, slot, equipped) {
        super(id, name, description, value, weight, type);
        this.slot = slot;
        this.equipped = equipped;
    }
}

class ItemWeapon extends ItemEquipment {
    constructor(id, name, description, value, weight, type, slot, equipped, damage, critical, range) {
        super(id, name, description, value, weight, type, slot, equipped);
        this.damage = damage;
        this.critical = critical;
        this.range = range;
    }
}

class ItemArmor extends ItemEquipment {
    constructor(id, name, description, value, weight, type, slot, equipped, defense, evasion) {
        super(id, name, description, value, weight, type, slot, equipped);
        this.defense = defense;
        this.evasion = evasion;
    }
}

class Shop {
    static items = [
        new ItemConsumable('healthPotion', 'Health Potion', 'A potion that restores health', 10, 1, 'consumable_hp', 10, 5),
        new ItemConsumable('manaPotion', 'Mana Potion', 'A potion that restores mana', 10, 1, 'consumable_mp', 10, 5),
        new ItemWeapon('sword', 'Sword', 'A sword', 10, 1, 'weapon', 'mainHand', false, 10, 10, 1),
        new ItemArmor('leatherArmor', 'Leather Armor', 'A piece of leather armor', 10, 1, 'armor', 'chest', false, 10, 10),
        new ItemArmor('chainmail', 'Chainmail', 'A piece of chainmail', 10, 1, 'armor', 'chest', false, 10, 10),
        new ItemArmor('plateArmor', 'Plate Armor', 'A piece of plate armor', 10, 1, 'armor', 'chest', false, 10, 10),
        new ItemArmor('boots', 'Boots', 'A pair of boots', 10, 1, 'armor', 'feet', false, 10, 10),
        new ItemArmor('gloves', 'Gloves', 'A pair of gloves', 10, 1, 'armor', 'hands', false, 10, 10),
        new ItemArmor('helmet', 'Helmet', 'A helmet', 10, 1, 'armor', 'head', false, 10, 10),
        new ItemArmor('legs', 'Legs', 'A pair of legs', 10, 1, 'armor', 'legs', false, 10, 10)
    ]

    static getItem(id) {
        return this.items.find(item => item.id === id);
    }

    static getItems() {
        return this.items;
    }

    static getItemsByType(type) {
        return this.items.filter(item => item.type === type);
    }

    static getItemsBySlot(slot) {
        return this.items.filter(item => item.slot === slot);
    }

    static getItemsByEquipped(equipped) {
        return this.items.filter(item => item.equipped === equipped);
    }
}

module.exports = {
    Database,
    User,
    Item,
    ItemConsumable,
    ItemEquipment,
    ItemWeapon,
    ItemArmor,
    Shop
}
