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
 *  1.0a  Mic-M * Add Wake on LAN/WiFi support to turn TV on
 *  0.6   Mic-M * Added Commands Ambilight Hue On/Off - thanks to BeautyBoyBob
 *  0.5   Mic-M * Initial release on Github
 *******************************************************************************/


/*******************************************************************************
 * Settings
 *******************************************************************************/
// Pfad, unter dem die Objekte angelegt werden.
const STATE_PATH = 'javascript.0.PhilipsTV-Script.';

// Generierung Username/Passwort: siehe https://forum.iobroker.net/post/352828
const PHILIPS_USER = 'xxxxxxxxxxxxxxxxxxxxx';
const PHILIPS_PASS = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

// Philips TV IP Addresse.
const PHILIPS_IP = 'xx.xx.xx.xx';  // Change accordingly to the IP address of your Philips TV.

// Philips TV Erweiterte Einstellungen. Erst mal nicht ändern und so belassen. Siehe hier für Details: https://github.com/eslavnov/pylips/wiki
const PHILIPS_PORT = 1926; // Android TVs primarily use port 1926, non-Android TV use port 1925 only. See https://github.com/eslavnov/pylips/wiki
const PHILIPS_API_VERSION = '6';
const PHILIPS_HTTP = 'https'; // you could change to 'http' if needed

// Kommando das zum TV einschalten abgesetzt wird. Default ist 'Key: Standby'.
// Genau so kann man hier z.B. 'Key: Home' nehmen, oder 'Launch: Netflix' für Netflix, etc. Siehe pCommands unten für alle möglichen Befehle.
const COMMAND_TO_LAUNCH = 'Key: Standby'; 


/**
 * Neu seit 12.01.2019:
 * WAKE ON LAN (WOL) / auch: WIFI (WLAN)
 * Wenn der Philips-TV für mehrere Minuten im Standby ist, dann ist dieser nicht mehr per PHILIPS_URL erreichbar.
 * Hiermit kann man WOL aktivieren und ein paar Einstellungen machen.
 * BITTE BEACHTET, DASS DIES EXPERIMENTIELL IST. Kann gut funktionieren (wie bei mir derzeit), ist aber noch nicht ausreichend getestet.
 * Siehe auch: https://forum.iobroker.net/topic/28843/tester-gesucht-wake-on-lan-wol-f%C3%BCr-philips-tv/
 * Wichtig:
 *  - In den Netzwerk-Einstellungen des Philips-TV "Mit WiFi (WoWLAN) einschalten" aktivieren.
 *    Hinweis: Das funktioniert auch bei mir bei einer reinen LAN-Verbindung, also ohne WLAN-Verbindung des Philips-TV.
 *  - ioBroker muss im selben Netzwerk sein.
 *  - (hier noch schreiben, was sonst noch zu beachten ist)
 */
const WOL_USE = true; // Verwendung von "Wake on Lan" / WiFi aktivieren. Falls false, dann werden die weiteren Settings nicht weiter beachtet.
const WOL_MAC_ADDR_1  = 'AA:AA:AA:AA:AA:AA';   // Philips TV MAC-Adresse. Bitte entsprechend eintragen (lt. "Netzwerkeinstellungen anzeigen" im Philips TV ersichtlich. Dabei entweder "Ethernet MAC Addresse" oder "MAC-Adressse, kabellos")
const WOL_MAC_ADDR_2  = '';   // 2. Philips TV MAC-Adresse. Man kann hier noch eine 2. MAC-Adresse angeben (z.B. 1. vom LAN, und diese 2. vom WiFi). Falls nicht benötigt, diese 2. Adresse leer lassen.
const WOL_PACKET_NUM = 5;  // Kann man so lassen; ggf. auf 6-10 erhöhen, falls es nicht funktioniert. Erklärung: Anzahl WOL-Pakete, die jeweils gesendet werden sollen (Number of packets to send). Default: 3
const WOL_PACKET_INTERVAL = 100;   // Kann man so lassen. Erklärung: Interval between each packet	(in ms). Default: 100
const WOL_A_DELAY = 4000; // Nach dieser Verzögerung in Millisekunden (ms) wird das eigentliche Kommando zum TV zum einschalten gesendet (COMMAND_TO_LAUNCH).

/**
 * WAKE ON LAN (WOL): ** ALTERNATIVE **  - EINSCHALTEN MITTELS EXTERNEM GERÄT
 * Falls WOL nicht bei euch funktioniert, könnt ihr hiermit ein externes Gerät verwenden, um den Philips-TV einzuschalten.
 * Ich verwende im Beispiel "Logitech Harmony" in Verbindung mit dem "harmony"-Adapter.
 */
const WOL_ALTERNATIVE_USE = false;  // Hiermit kann man das "Einschalten mittels externem Gerät" aktivieren, indem man auf true setzt. Falls false, dann werden die weiteren Settings nicht weiter beachtet.
const CONTROL_DEVICE_STATE = 'harmony.0.Harmony_Hub_4.Philips_TV.PowerToggle';  // State zum Gerät, das den TV ein/aus schaltet
const CONTROL_DEVICE_CMD_ON = 1;  // Was in den Datenpunkt zum einschalten gesetzt werden muss. Bei Harmony ist dies ein Toggle, es wird 1 erwartet.


// Logging
const LOG_INFO = true;   // Auf true setzen, wenn ein paar Infos dieses Scripts im Log ausgegeben werden dürfen, bei false bleiben die Infos komplett weg.
const LOG_DEBUG = true;  // Auf true setzen, wenn zur Fehlersuche einige Meldungen ausgegeben werden sollen.


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
pCommands['Launch: Home']  = ['input/key',   '{"key":"Home"}']; // Same as 'Key: Home' below.
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

// Define the final URL to Philips TV
const PHILIPS_FINAL_URL = PHILIPS_HTTP + '://' + PHILIPS_IP + ':' + PHILIPS_PORT + '/' + PHILIPS_API_VERSION + '/';


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
        let exec = require('child_process').exec;
        let postArgs = "-X POST --digest --insecure -u " + PHILIPS_USER + ":" + PHILIPS_PASS + " -d '" + pCommands[id][1] + "' " + PHILIPS_FINAL_URL + pCommands[id][0];
        exec('curl ' + postArgs, function (error, stdout, stderr) {
            if(LOG_INFO) log('Sending command [' + id + '] to Philips TV.');
            if (LOG_DEBUG && stdout != '') log('[Debug] stdout: ' + stdout);
            if (error !== null) {
                log('TV seems to be off and in deep sleep, so we could not send command [' + id + '] to the TV.', 'warn');
                if (LOG_DEBUG) log('[Debug] Error message: ' + error);
            }
        });
    } else if (id == '') {
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
    let args = "-X GET --digest --insecure -u " + PHILIPS_USER + ":" + PHILIPS_PASS + " " + PHILIPS_FINAL_URL + "powerstate";
    exec('curl ' + args, function (error, stdout, stderr) {
        if (error) {

            // TV is not reachable.
            if (LOG_DEBUG) log('[Debug] TV is not reachable and in deep sleep.'); // we could provide stderr here. But actually don't need it at this time in log.

            if(pwrState) {
                //TV shall be turned on.
                // Since it is not reachable, we assume it is off.
                // Therefore we need to wake up or use an external device
                if (LOG_DEBUG) log('[Debug] Starting with turning TV on...');
                if (WOL_USE) {
                    if (LOG_DEBUG) log('[Debug] Per script config, TV shall be turned on via WOL. Now executing accordingly.');

                    // We execute WOL to be able to reach the TV and turn it on.
                    let macArray = cleanArray([WOL_MAC_ADDR_1, WOL_MAC_ADDR_2]);
                    wakeOnLan(macArray, function() {
                        if (LOG_DEBUG) log ('[Debug] WOL packets successfully sent. Now we wait ' + WOL_A_DELAY + ' ms, until we launch the TV.');
                        // We need a timeout here, since the TV will need some time after WOL to be able to receive commands.
                        setTimeout(function() {
                            if (LOG_DEBUG) log('[Debug] Command [ ' + COMMAND_TO_LAUNCH + '] sent to TV to turn it on.')
                            doPostCommand(COMMAND_TO_LAUNCH);
                        }, WOL_A_DELAY)

                    });

                } else if (!WOL_USE && WOL_ALTERNATIVE_USE) {
                    if (LOG_DEBUG) log('[Debug] Per script config, TV shall be turned on via external device. Now executing accordingly.');
                    // We use an external device to turn TV on
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
            if (LOG_DEBUG) log('[Debug] We have connection to the TV. Power State: ' + powerStateStr);

            if(pwrState) {
                //TV shall be turned on.
                if ( powerStateStr === 'Standby') {
                    // TV is in Standby, so let's turn it on
                    doPostCommand(COMMAND_TO_LAUNCH);
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


/**
 * Send WOL packets to provided MAC addresses.
 * @param {array} macAddresses  Array of strings containing MAC addresses
 * @param {object} [callback]  Optional: a callback function -- This provided function will be executed once all WOL packets were sent.
 */
function wakeOnLan(macAddresses, callback) {
 
    let wol = require('wake_on_lan');
    let numMacs = macAddresses.length;
    macAddresses.forEach(function(loopMacAddress) {

        wol.wake(loopMacAddress, { num_packets:WOL_PACKET_NUM, interval:WOL_PACKET_INTERVAL }, function(error) {
        if (LOG_DEBUG) log ('[Debug] Currently processing MAC address [' + loopMacAddress + '].');
            if (error) {
                log('Error occurred while sending ' + WOL_PACKET_NUM + ' WOL packets to [' + loopMacAddress + ']', 'warn');
            } else {
                if (LOG_DEBUG) log('[Debug] Sending  ' + WOL_PACKET_NUM + ' WOL packets to [' + loopMacAddress + '] successfully exectuted.');
                numMacs--;
                if (numMacs === 0) {
                    if (LOG_DEBUG) log('[Debug] Completed: all MAC addresses processed.');
                    if (typeof callback === 'function') { // execute if a function was provided to parameter callback
                        //if (LOG_DEBUG) log('[Debug] Function was provided in callback parameter');
                        return callback();
                    }
                }
            }
        });

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


/**
 * Clean Array: Removes all falsy values: undefined, null, 0, false, NaN and "" (empty string)
 * Source: https://stackoverflow.com/questions/281264/remove-empty-elements-from-an-array-in-javascript
 * @param {array} inputArray       Array to process
 * @return {array}  Cleaned array
 */
function cleanArray(inputArray) {
  let newArray = [];
  for (let i = 0; i < inputArray.length; i++) {
    if (inputArray[i]) {
      newArray.push(inputArray[i]);
    }
  }
  return newArray;
}
