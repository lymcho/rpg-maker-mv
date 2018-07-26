"use strict";

//=============================================================================
// YEP Party System and Row Formation Modifications
// ALOE_YEP_PartyRow_Modifications
//=============================================================================

//=============================================================================
/*:
 * @plugindesc v0.1.0 YEP Party System and Row Formation Modifications
 * @author Aloe Guvner
 *
 * @param formationCompareStrictness
 * @text Formation Compare Strictness
 * @type select
 * @option Loose
 * @value 1
 * @option Strict
 * @value 2
 * @desc Strictness level to check if cooldown should
 * be triggered after the Party Formation scene. (see help)
 * @default 1
 * 
 * @help
 * Current Functionality:
 * 
 * 1. Modifies the cooldown behavior on the Row command to only trigger
 * the cooldown if the rows are changed.
 * 2. Modifies the cooldown behavior on the Party System command to only
 * trigger the cooldown if the party is changed.
 *
 * ============================================================================
 * Parameters
 * ============================================================================
 * 
 * __Formation Compare Strictness__
 * 
 * The party is be examined before and after the player uses the Party Formation
 * scene to change their party.
 * The cooldown of this command will trigger if any change is detected in the
 * party from this scene.
 * 
 * The options available for this parameter control how 'strict' the check
 * for changes is.
 * 
 * Loose --> The cooldown is triggered if battle members are substituted.
 * --Example: Harold (in battle) is swapped for Suzie (in reserves)
 * --Example: Lucius (in battle) is sent to reserves (no replacement)
 * --Note: Rearranging actors in battle such as swapping Harold/Marsha (1st/3rd)
 * does not trigger the cooldown.
 * 
 * Strict --> The cooldown is triggered if battle members are substituted OR
 * change order.
 * --Example: Harold (in battle) is swapped for Suzie (in reserves)
 * --Example: Lucius (in battle) is sent to reserves (no replacement)
 * --Example: Harold (1st) and Marsha (3rd) swap positions.
 * 
*/
//=============================================================================

var Parameters = {};

//=============================================================================
// Utils
//=============================================================================
// Create a utility function to parse complex parameters.
//=============================================================================

Utils.recursiveParse = function (param) {
    try {
        return JSON.parse(param, function (key, value) {
            try {
                return this.recursiveParse(value);
            } catch (e) {
                return value;
            }
        }.bind(this));
    } catch (e) {
        return param;
    }
};

//=============================================================================
// Parameters
//=============================================================================
// Read and parse parameters into a locally scoped Parameters object.
//=============================================================================

Object.keys(PluginManager.parameters("ALOE_YEP_PartyRow_Modifications")).forEach(function (a) {
    return Parameters[a] = Utils.recursiveParse(PluginManager.parameters("ALOE_YEP_PartyRow_Modifications")[a]);
});

//=============================================================================
// Row Formation section
//=============================================================================

//=============================================================================
// Aliased Methods - Row Formation section
//=============================================================================

// Cooldown is currently set when the Row screen is opened, reset the cooldown instead
var Scene_Battle_partyCommandRow = Scene_Battle.prototype.partyCommandRow;
Scene_Battle.prototype.partyCommandRow = function () {
    Scene_Battle_partyCommandRow.call(this);
    $gameSystem.resetBattleRowCooldown();
};

// Cache a snapshot of the row state upon entering the scene
var Scene_Row_initialize = Scene_Row.prototype.initialize;
Scene_Row.prototype.initialize = function () {
    Scene_Row_initialize.call(this);
    if ($gameParty.inBattle()) {
        $gameTemp.oldRowState = this.getCurrentRowState();
    }
};

// Insert the cooldown check into the popScene handler
var Scene_Row_popScene = Scene_Row.prototype.popScene;
Scene_Row.prototype.popScene = function () {
    if ($gameParty.inBattle()) {
        if (this.didAnythingChange($gameTemp.oldRowState)) {
            $gameSystem.setBattleRowCooldown();
        }
        delete $gameTemp.oldRowState;
    }
    Scene_Row_popScene.call(this);
};

//=============================================================================
// New Methods - Row Formation Cooldown Modification
//=============================================================================

/**
 * Get a snapshot of the current state of the Actor IDs and Row IDs.
 *
 * @method Scene_Row.prototype.getCurrentRowState
 * @return {Object} Object containing a mapping of Actor ID to Row ID.
 */
Scene_Row.prototype.getCurrentRowState = function () {
    return $gameParty.battleMembers().reduce(function (acc, cur, i) {
        acc[i] = cur.row();
        return acc;
    }, {});
};

/**
 * Check if the current state is different than the cached state.
 *
 * @method Scene_Row.prototype.didAnythingChange
 * @param {Object} object The old state of the actor rows.
 * @return {Boolean} True if the new state is different than the old state.
 */
Scene_Row.prototype.didAnythingChange = function (oldState) {
    var currentState = this.getCurrentRowState();
    for (var actorId in oldState) {
        if (oldState[actorId] !== currentState[actorId]) {
            return true;
        }
    }
    return false;
};

//=============================================================================
// Party Formation Cooldown Modification
//=============================================================================

//=============================================================================
// Aliased Methods - Party Formation section
//=============================================================================

// Cooldown is currently set when the Formation screen is opened, reset the cooldown instead
var Scene_Battle_partyCommandFormation = Scene_Battle.prototype.partyCommandFormation;
Scene_Battle.prototype.partyCommandFormation = function () {
    Scene_Battle_partyCommandFormation.call(this);
    $gameSystem.resetBattleFormationCooldown();
};

// Cache a snapshot of the formation state upon entering the scene
var Scene_Party_initialize = Scene_Party.prototype.initialize;
Scene_Party.prototype.initialize = function () {
    Scene_Party_initialize.call(this);
    if ($gameParty.inBattle()) {
        $gameTemp.oldFormationState = this.getCurrentFormationState();
    }
};

// Insert the cooldown check into the commandFinish handler
var Scene_Party_commandFinish = Scene_Party.prototype.commandFinish;
Scene_Party.prototype.commandFinish = function () {
    if ($gameParty.inBattle()) {
        if (this.didAnythingChange($gameTemp.oldFormationState)) {
            $gameSystem.setBattleFormationCooldown();
        }
        delete $gameTemp.oldFormationState;
    }
    Scene_Party_commandFinish.call(this);
};

//=============================================================================
// New Methods - Party Formation section
//=============================================================================

/**
 * Get a current list of the actors in the battle/party.
 *
 * @method Scene_Party.prototype.getCurrentRowState
 * @return {Array} Array containing actors currently in battle/party.
 */
Scene_Party.prototype.getCurrentFormationState = function () {
    return $gameParty.battleMembers().map(function (actor) {
        return actor.actorId();
    });
};

/**
 * Check if the current state is different than the cached state.
 *
 * @method Scene_Party.prototype.didAnythingChange
 * @param {Object} object The old state of the actor formation.
 * @return {Boolean} True if the new state is different than the old state.
 */
Scene_Party.prototype.didAnythingChange = function (oldState) {
    var currentState = this.getCurrentFormationState();
    switch (Parameters.formationCompareStrictness) {
        case 1:
            // loose
            return !oldState.sort().equals(currentState.sort());
        case 2:
            // strict
            return !oldState.equals(currentState);
    }
};

// WORK IN PROGRESS
// Dynamically display cooldown text or gauge in the party command window

// // Alter this to show the cooldown [actually look into the refresh method because this is only called once]
// Window_PartyCommand.prototype.addFormationCommand = function () {
//     if (!$gameSystem.isShowBattleFormation()) return;
//     var index = this.findSymbol('escape');
//     var enabled = $gameSystem.isBattleFormationEnabled();
//     this.addCommandAt(index, TextManager.formation, 'formation', enabled);
// };

// // Alter this to show cooldown [actually look into the refresh method because this is only called once]
// Window_MenuCommand.prototype.addRowCommand = function () {
//     if (!$gameSystem.isShowRowMenu()) return;
//     if (this.findSymbol('row') > -1) return;
//     var text = Yanfly.Param.RowCmdName;
//     var enabled = $gameSystem.isEnabledRowMenu();
//     this.addCommand(text, 'row', enabled);
// };