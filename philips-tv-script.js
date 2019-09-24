/*******************************************************************************
 * ---------------------------
 * Philips TV Script for ioBroker
 * ---------------------------
 *
 * Da der Philips-TV-Adapter noch nicht wie gewünscht funktioniert, habe ich dieses
 * Script geschrieben, um Philips-TVs zu steuern.
 *
 * ----------------------------------------------------
 * Aktuelle Version:    https://github.com/Mic-M/iobroker.philips-tv-script
 * Support:             https://forum.iobroker.net/topic/8791/aufruf-philips-tv-v0-1-0-testen
 * ----------------------------------------------------
 * Resources:
 *  - ioBroker Philips TV Adapter: https://forum.iobroker.net/topic/8791/aufruf-philips-tv-v0-1-0-testen
 *  - Many thanks to Evgeny Slavnov for the unofficial Philips TV API Reference: https://github.com/eslavnov/pylips/wiki
 *  - Python Script with MQTT support: https://github.com/eslavnov/pylips
 *  - Some info: https://community.openhab.org/t/philips-tv-2016-binding/64579/61
 * ----------------------------------------------------
 * Change Log:
 *  0.6  Mic-M * Added Commands Ambilight Hue On/Off - thanks to BeautyBoyBob
 *  0.5  Mic-M * Initial release on Github
 *******************************************************************************/


/*******************************************************************************
 * Settings
 *******************************************************************************/
// Pfad, unter dem die Objekte angelegt werden.
const STATE_PATH = 'javascript.0.PhilipsTV-Script.';

// Generate User/Password: see https://github.com/nstrelow/ha_philips_2016
const PHILIPS_USER = 'xxxxxxxxxxxxxxxxxxxxx';
const PHILIPS_PASS = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

// URL, change IP address accordingly (and you may also need to change port, see for example https://github.com/eslavnov/pylips)
const PHILIPS_URL = 'https://xx.xx.xx.xx:1926/6/';

// Logging
const LOG_INFO = true;
const LOG_DEBUG = false;

/**
 * Falls Philips-TV für mehrere Minuten im Standby ist, ist dieser nicht mehr per PHILIPS_URL erreichbar.
 * Dann lässt dieser sich nicht per Script einschalten. Daher verwenden wir ein separates Gerät,
 * um den TV einzuschalten. Bei mir: Logitech Harmony
 */
// Auf false setzen, wenn man kein Gerät hat, um den Philips zu schalten. Dann werden die weiteren 2 Settings nicht weiter beachtet.
const CONTROL_DEVICE_USE = true;
// State zum Gerät, das den TV ein/aus schaltet
const CONTROL_DEVICE_STATE = 'harmony.0.Harmony_Hub_4.Philips_TV.PowerToggle';
// Was in den Datenpunkt zum einschalten gesetzt werden muss. Bei Harmony ist dies ein Toggle, es wird 1 erwartet.
const CONTROL_DEVICE_CMD_ON = 1;


/*******************************************************************************
 * Expert Settings
 *******************************************************************************/

// Hier definieren wir die einzelnen Post Commands. 
let pCommands = [];
//        0.Command Name                       1.Path              2. curl Command      
pCommands['Cmd: Ambilight Hue On'] = ['menuitems/settings/update',   '{"values":[{"value":{"Nodeid":2131230774,"Controllable":"true","Available":"true","data":{"value":"true"}}}]}'];  
pCommands['Cmd: Ambilight Hue Off'] = ['menuitems/settings/update',   '{"values":[{"value":{"Nodeid":2131230774,"Controllable":"true","Available":"true","data":{"value":"false"}}}]}'];  
pCommands['Cmd: Ambilight Off']             = ['ambilight/power',   '{"power":"Off"}'];
pCommands['Cmd: Ambilight On']              = ['ambilight/power',   '{"power":"On"}'];
pCommands['Cmd: Ambilight On Video Standard'] = ['ambilight/currentconfiguration',   '{"styleName":"FOLLOW_VIDEO","isExpert":false,"menuSetting":"STANDARD"}'];
pCommands['Cmd: Ambilight On Video Immersive'] = ['ambilight/currentconfiguration',   '{"styleName":"FOLLOW_VIDEO","isExpert":false,"menuSetting":"IMMERSIVE"}'];
pCommands['Cmd: Ambilight On Video Natural'] = ['ambilight/currentconfiguration',   '{"styleName":"FOLLOW_VIDEO","isExpert":false,"menuSetting":"NATURAL"}'];
pCommands['Cmd: Ambilight On Video Vivid'] = ['ambilight/currentconfiguration',   '{"styleName":"FOLLOW_VIDEO","isExpert":false,"menuSetting":"VIVID"}'];
pCommands['Cmd: Ambilight On Video Game'] = ['ambilight/currentconfiguration',   '{"styleName":"FOLLOW_VIDEO","isExpert":false,"menuSetting":"GAME"}'];
pCommands['Cmd: Ambilight On Video Comfort'] = ['ambilight/currentconfiguration',   '{"styleName":"FOLLOW_VIDEO","isExpert":false,"menuSetting":"COMFORT"}'];
pCommands['Cmd: Ambilight On Video Relax'] = ['ambilight/currentconfiguration',   '{"styleName":"FOLLOW_VIDEO","isExpert":false,"menuSetting":"RELAX"}'];
pCommands['Launch: Amazon Prime Video'] = ['activities/launch',   '{"id":"com.amazon.amazonvideo.livingroom","order":0,"intent":{"action":"Intent{act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10000000 pkg=com.amazon.amazonvideo.livingroom }","component":{"packageName":"com.amazon.amazonvideo.livingroom","className":"com.amazon.ignition.IgnitionActivity"}},"label":"Prime Video"}'];
pCommands['Launch: Kodi'] = ['activities/launch',   '{"id":"org.xbmc.kodi","order":0,"intent":{"action":"Intent{act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10000000 pkg=org.xbmc.kodi }","component":{"packageName":"org.xbmc.kodi","className":"org.xbmc.kodi.Splash"}},"label":"Kodi"}'];
pCommands['Launch: Netflix'] = ['activities/launch',   '{"id":"com.netflix.ninja","order":0,"intent":{"action":"Intent{act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10000000 pkg=com.netflix.ninja }","component":{"packageName":"com.netflix.ninja","className":"com.netflix.ninja.MainActivity"}},"label":"Netflix"}'];
pCommands['Launch: YouTube'] = ['activities/launch',   '{"id":"com.google.android.apps.youtube.tv.activity.ShellActivity-com.google.android.youtube.tv","order":0,"intent":{"action":"Intent{act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10000000 pkg=com.google.android.youtube.tv cmp=com.google.android.youtube.tv/com.google.android.apps.youtube.tv.activity.ShellActivity }","component":{"packageName":"com.google.android.youtube.tv","className":"com.google.android.apps.youtube.tv.activity.ShellActivity"}},"label":"YouTube"}'];
pCommands['Key: Adjust']  = ['input/key',   '{"key":"Adjust"}'];
pCommands['Key: AmbilightOnOff']  = ['input/key',   '{"key":"AmbilightOnOff"}'];
pCommands['Key: Back']  = ['input/key',   '{"key":"Back"}'];
pCommands['Key: BlueColour']  = ['input/key',   '{"key":"BlueColour"}'];
pCommands['Key: ChannelStepDown']  = ['input/key',   '{"key":"ChannelStepDown"}'];
pCommands['Key: ChannelStepUp']  = ['input/key',   '{"key":"ChannelStepUp"}'];
pCommands['Key: Confirm']  = ['input/key',   '{"key":"Confirm"}'];
pCommands['Key: CursorDown']  = ['input/key',   '{"key":"CursorDown"}'];
pCommands['Key: CursorLeft']  = ['input/key',   '{"key":"CursorLeft"}'];
pCommands['Key: CursorRight']  = ['input/key',   '{"key":"CursorRight"}'];
pCommands['Key: CursorUp']  = ['input/key',   '{"key":"CursorUp"}'];
pCommands['Key: Digit0']  = ['input/key',   '{"key":"Digit0"}'];
pCommands['Key: Digit1']  = ['input/key',   '{"key":"Digit1"}'];
pCommands['Key: Digit2']  = ['input/key',   '{"key":"Digit2"}'];
pCommands['Key: Digit3']  = ['input/key',   '{"key":"Digit3"}'];
pCommands['Key: Digit4']  = ['input/key',   '{"key":"Digit4"}'];
pCommands['Key: Digit5']  = ['input/key',   '{"key":"Digit5"}'];
pCommands['Key: Digit6']  = ['input/key',   '{"key":"Digit6"}'];
pCommands['Key: Digit7']  = ['input/key',   '{"key":"Digit7"}'];
pCommands['Key: Digit8']  = ['input/key',   '{"key":"Digit8"}'];
pCommands['Key: Digit9']  = ['input/key',   '{"key":"Digit9"}'];
pCommands['Key: Dot']  = ['input/key',   '{"key":"Dot"}'];
pCommands['Key: FastForward']  = ['input/key',   '{"key":"FastForward"}'];
pCommands['Key: Find']  = ['input/key',   '{"key":"Find"}'];
pCommands['Key: GreenColour']  = ['input/key',   '{"key":"GreenColour"}'];
pCommands['Key: Home']  = ['input/key',   '{"key":"Home"}'];
pCommands['Key: Info']  = ['input/key',   '{"key":"Info"}'];
pCommands['Key: Mute']  = ['input/key',   '{"key":"Mute"}'];
pCommands['Key: Next']  = ['input/key',   '{"key":"Next"}'];
pCommands['Key: Online']  = ['input/key',   '{"key":"Online"}'];
pCommands['Key: Options']  = ['input/key',   '{"key":"Options"}'];
pCommands['Key: Pause']  = ['input/key',   '{"key":"Pause"}'];
pCommands['Key: Play']  = ['input/key',   '{"key":"Play"}'];
pCommands['Key: PlayPause']  = ['input/key',   '{"key":"PlayPause"}'];
pCommands['Key: Previous']  = ['input/key',   '{"key":"Previous"}'];
pCommands['Key: Record']  = ['input/key',   '{"key":"Record"}'];
pCommands['Key: RedColour']  = ['input/key',   '{"key":"RedColour"}'];
pCommands['Key: Rewind']  = ['input/key',   '{"key":"Rewind"}'];
pCommands['Key: Source']  = ['input/key',   '{"key":"Source"}'];
pCommands['Key: Standby']  = ['input/key',   '{"key":"Standby"}'];
pCommands['Key: Stop']  = ['input/key',   '{"key":"Stop"}'];
pCommands['Key: Subtitle']  = ['input/key',   '{"key":"Subtitle"}'];
pCommands['Key: Teletext']  = ['input/key',   '{"key":"Teletext"}'];
pCommands['Key: Viewmode']  = ['input/key',   '{"key":"Viewmode"}'];
pCommands['Key: VolumeDown']  = ['input/key',   '{"key":"VolumeDown"}'];
pCommands['Key: VolumeUp']  = ['input/key',   '{"key":"VolumeUp"}'];
pCommands['Key: WatchTV']  = ['input/key',   '{"key":"WatchTV"}'];
pCommands['Key: YellowColour']  = ['input/key',   '{"key":"YellowColour"}'];



/***************************************************************************************************************
 ******************************* Ab hier nichts mehr ändern / Stop editing here! *******************************
 ***************************************************************************************************************/


/*******************************************************************************
 * Initial Function
 *******************************************************************************/
init();
function init() {
    
    // 1. Create states
    createScriptStates();

    // 2. Subscriptions
    setTimeout(subscribeStates, 2000);

}

/**
 * Subscribe to States.
 */
function subscribeStates() {
    // Command pull-down menu state
    on({id: STATE_PATH + 'Command', change:'any'}, function (obj) {
        doPostCommand(obj.state.val);
    });

    // TV on/off buttons
    on({id: STATE_PATH + 'TvOn', val:true}, function (obj) {
       powerPhilipsTv(true);
    });  
    on({id: STATE_PATH + 'TvOff', val:true}, function (obj) {
       powerPhilipsTv(false);
    });  

}



/**
 * Setzt den entsprechenden Befehl ab.
 * @param {string} id   Command Name von pCommands
 */
function doPostCommand(id) {
    if (id in pCommands) { // Check if Key exists and typed correctly - https://stackoverflow.com/questions/1098040/checking-if-a-key-exists-in-a-javascript-object
        var exec = require('child_process').exec;
        let postArgs = "-X POST --digest --insecure -u " + PHILIPS_USER + ":" + PHILIPS_PASS + " -d '" + pCommands[id][1] + "' " + PHILIPS_URL + pCommands[id][0];
        exec('curl ' + postArgs, function (error, stdout, stderr) {
            if (LOG_DEBUG) log('stdout: ' + stdout);
            if (LOG_DEBUG) log('stderr: ' + stderr);
            if (error !== null) {
                log('exec error: ' + error);
            }
        });
    } else if(id == '') {
        // do nothing, will be empty if script is initally started or user did not select value
    } else {
        log('Wrong command provided to Philips TV: [' + id + ']', 'warn');
    }
}

/**
 *  Philips TV ein- und ausschalten.
 *  @param {boolean}  pwrState   true zum Einschalten, false zum Ausschalten.
 */
function powerPhilipsTv(pwrState) {
    // We need to get the GET command to get the TV's powerstate
    let exec = require('child_process').exec;
    let args = "-X GET --digest --insecure -u " + PHILIPS_USER + ":" + PHILIPS_PASS + " " + PHILIPS_URL + "powerstate";
    exec('curl ' + args, function (error, stdout, stderr) {
        if (error) {

            // TV is not reachable.
            
            if (LOG_DEBUG) log('stderr: ' + stderr, 'warn');

            if(pwrState) {
                //TV shall be turned on.

                // Since it is not reachable, we assume it is off.
                // Therefore we turn it on through external device
                if (CONTROL_DEVICE_USE) {
                    setState(CONTROL_DEVICE_STATE, CONTROL_DEVICE_CMD_ON);
                    if (LOG_INFO) log('Execute turning TV on: TV is in deep sleep, turning it on now...')
                } else {
                    if (LOG_INFO) log('Execute turning TV on: TV is off and in deep sleep, no chance to turn it on.', 'warn');
                }

            } else {
                // TV shall be turned off.
                // Since it is not reachable, we assume it is off already.
                // So we do nothing
                if (LOG_INFO) log('Execute turning TV off: TV is already turned off and in deep sleep.')
            }

        } else {

            // TV is reachable.
            
            // What is the TV's status?
            let powerStateStr = stdout;
            powerStateStr = powerStateStr.replace(/powerstate/gi, ''); // remove term 'powerstate'
            powerStateStr = powerStateStr.replace(/([^a-z]+)/gi, ''); // just keep a-z
            if (LOG_INFO) log('We have connection to the TV. Power State: ' + powerStateStr);

            if(pwrState) {
                //TV shall be turned on.
                if ( powerStateStr === 'Standby') {
                    // TV is in Standby, so let's turn it on
                    if (CONTROL_DEVICE_USE) {
                        // Although TV is reachable, we use the external device, as it might be that it is no longer
                        // reachable in the meantime, as POST command can take a few (m)seconds
                        setState(CONTROL_DEVICE_STATE, CONTROL_DEVICE_CMD_ON);
                    } else {
                        doPostCommand('Key: Home');
                    }
                    if (LOG_INFO) log('Execute turning TV on: turning it on now...')
                } else {
                    // Nothing, since TV is not in Standby.
                    if (LOG_INFO) log('Execute turning TV on: TV is already turned on, so no action.')
                }

            } else {
                // TV shall be turned off.
                if ( powerStateStr === 'Standby') {
                    // TV is in Standby, so we do nothing else.
                    if (LOG_INFO) log('Execute turning TV off: TV is already in Standby, so no action.')
                } else {
                    // TV is not in Standby, so turn off.
                    doPostCommand('Key: Standby');
                    if (LOG_INFO) log('Execute turning TV off: turning it off now...')
                }                
            }
        }
    });
}


function createScriptStates() {

    /**
     *  Command state Drop-down 
     */
    // create drop-down list
    let dropdown = '';
    for (let lpEntry of Object.keys(pCommands)) {   // 'special' loop here to get the keys
        dropdown += '"' + lpEntry + '":"' + lpEntry + '",'; // fill JSON string
    }
    dropdown = dropdown.substr(0, dropdown.length-1); // remove last comma ","
    dropdown = '{' + dropdown + '}'; // finalize JSON string
    let dropdownJSON = JSON.parse(dropdown); // convert to JSON

    // Create state. Force is set to true, so we will always update the states if e.g. configuration in this script changed.
    createState(STATE_PATH + 'Command', '', true, {'name':'Send Command to Philips TV', 'type':'string', 'read':false, 'write':true, 'role':'value', 'states': dropdownJSON});

    /**
     *  TV on/off states
     */
    createState(STATE_PATH + 'TvOn',  {'name':'Turn TV On',  'type':'boolean', 'read':false, 'write':true, 'role':'button', 'def':false });
    createState(STATE_PATH + 'TvOff', {'name':'Turn TV Off', 'type':'boolean', 'read':false, 'write':true, 'role':'button', 'def':false });

}
