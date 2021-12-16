class Permission {
    static checkPermission(perm1, perm2) {
        perm1 = perm1.split('.');
        perm2 = perm2.split('.');

        for (let i = 0; i < perm1.length; i++) {
            if (perm1[i] == perm2[i]) {
                continue;
            }

            if (perm1[i] == '*') {
                return true;
            }

            if (perm2[i] == '*') {
                return true;
            }

            return false;
        }
    }
}

class PermissionGroup {
    static ALL_GROUPS = [];

    static findGroup(id) {
        for (let i = 0; i < PermissionGroup.ALL_GROUPS.length; i++) {
            if (PermissionGroup.ALL_GROUPS[i].id == id) {
                return PermissionGroup.ALL_GROUPS[i];
            }
        }
    }

    constructor(id, displayName, permissions) {
        this.id = id;
        this.displayName = displayName;
        this.permissions = permissions || [];

        PermissionGroup.ALL_GROUPS.push(this);
    }

    addPermission(permission) {
        this.permissions.push(permission);
    }

    hasPermission(permission) {
        for (let i = 0; i < this.permissions.length; i++) {
            if (Permission.checkPermission(this.permissions[i], permission)) {
                return true;
            }
        }
        return false;
    }

    static OWNER = new PermissionGroup("owner", "Owner", ["owner.*", "*"]);
    static ADMIN = new PermissionGroup("admin", "Admin", ["admin.*", "mod.*"]);
    static MOD = new PermissionGroup("mod", "Moderator", ["mod.*"]);
    static USER = new PermissionGroup("user", "User", ["user.*", "command.*"]);
}

module.exports = {
    PermissionGroup,
    Permission
}
