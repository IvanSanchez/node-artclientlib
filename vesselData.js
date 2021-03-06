
// Reads vesselData.xml and the *.snt files and stores its data structures in
//   the module's exports

var xml    = require("node-xml-lite")
  , fs     = require('fs')
  , path   = require('path')
  , config = require('config');

var datDir = config.datDir;
var file;



// Sorry for the ugly code for detecting the right directory. The
//   try-catches have to be there in case a sandboxed environment throws out
//   an error. I'd be happy to see suggestions for a cleaner solution.
var vesselDataFileFound = false;

// Check if the vesselData.xml file exists, update the global vars if so.
function lookForVesselDataFile(dir) {
    if (vesselDataFileFound) {
        return false;
    }
    if (dir === undefined) {
				return false;
		}
    console.log('Looking for vesselData.xml file in', dir);
    if (fs.existsSync(path.resolve(dir,config.datDir,'vesselData.xml'))) {
        console.log('Found a vesselData.xml file!');
        vesselDataFileFound = true;
        return datDir = path.resolve(dir,config.datDir);
    } else {
        return false;
    }
}

lookForVesselDataFile();

try { lookForVesselDataFile(process.execPath); } catch(e) {}
try { lookForVesselDataFile(module.uri);       } catch(e) {}
try { lookForVesselDataFile(process.env.PWD);  } catch(e) {}
try { lookForVesselDataFile(process.cwd());    } catch(e) {}
try {
    var gui = require('nw.gui');
    lookForVesselDataFile(gui.App.DataPath);
} catch(e) {}

console.log('Using vesselData.xml and *.snt from directory: ', datDir);

try {
    file = fs.readFileSync(path.resolve(datDir,'vesselData.xml'));
} catch(e) {
	console.warn('Could not find the file vesselData.xml !!!');
	exports.vessels  = {};
	exports.factions = {};
	return;
}

// Skip byte-order mark by skipping bytes until a "<" is found.
while(file.readUInt8(0) != 0x3c) {
    file = file.slice(1);
    console.log('Skipped one character');
}

var tree = xml.parseBuffer(file);

exports.version = tree.attrib.version;

// console.log(tree.childs);

var systemMap = {
    '-2': 'Void',
    '-1': 'Hall',
    0: 'Beam',
    1: 'Torp',
    2: 'Sens',
    3: 'Mnvr',
    4: 'Impl',
    5: 'Warp',
    6: 'Fshd',
    7: 'Rshd',
}

function readSnt(filename) {

    var sntFile;

    try {
        sntFile = fs.readFileSync(dir + '/' + filename);
    } catch(e) {
        console.warn('Could not find the file ' + filename + ' !!!');
        exports.vessels  = {};
        exports.factions = {};
        return;
    }


    var i = 0;
    var grid = {};

    for (var x=-2; x<=2; x++) {
        grid[x] = {};
        for (var y=-2; y<=2; y++) {
            grid[x][y] = {};
            for (var z=0; z<=9; z++) {

                var graphicX = sntFile.readFloatLE(i);
                var graphicY = sntFile.readFloatLE(i+4);
                var graphicZ = sntFile.readFloatLE(i+8);
                var sys      = sntFile.readInt32LE(i+12);

//                 var a   = sntFile.readInt32LE(i+16);
//                 var b   = sntFile.readInt32LE(i+20);
//                 var c   = sntFile.readInt32LE(i+24);
//                 var d   = sntFile.readInt32LE(i+28);

//                 console.log(x,y,z,a,b,c,d,graphicX,graphicY,graphicZ,sys);
                if (sys != -2) {
                    grid[x][y][z] = {
                        sys:sys,
                        graphicX: graphicX,
                        graphicY: graphicY,
                        graphicZ: graphicZ
                    };
//                     console.log(x,y,z,/*a,b,c,d,*/graphicX,graphicY,graphicZ,systemMap[sys]);
                }

                i+=32;
            }
        }
    }
    return grid;
}

var factions = {};
var vessels  = {};

for (i in tree.childs) {
    var node = tree.childs[i];
    if (node.name == 'hullRace') {
        console.log('Read Faction ', node.attrib.ID, node.attrib.name);
        factions[node.attrib.ID] = {name: node.attrib.name, taunts:[]};
        for (j in node.childs) {
            factions[node.attrib.ID].taunts.push(node.childs[j].attrib);
        }
    }
    if (node.name == 'vessel') {
        var vessel = {
            faction: node.attrib.side,
            classname: node.attrib.classname,
            beams: [],
            tubes: [],
            torpedoStorage: {},
            engines: [],
            description: ''
        };

        for (j in node.childs) {
            var name   = node.childs[j].name;
            var attrib = node.childs[j].attrib;
            if (name=='internal_data') {
                vessel.sntFile = attrib.file.replace('dat/','');
                vessel.grid = readSnt(vessel.sntFile);
            }
            else if (name=='shields') {
                vessel.frontShields = attrib.front;
                vessel.rearShields  = attrib.back;
            }
            else if (name=='torpedo_tube') {
                vessel.tubes.push(attrib);
            }
            else if (name=='beam_port') {
                vessel.beams.push(attrib);
            }
            else if (name=='torpedo_storage') {
                vessel.torpedoStorage[attrib.type] = attrib.amount;
            }
            else if (name=='engine_port') {
                vessel.engines.push(attrib);
            }
            else if (name=='long_desc') {
                vessel.description = attrib.text;
            }
            else if (name=='performance') {
                vessel.performance = attrib;
            }
            else {
//                 console.log('Unknown element: ', name)
            }

        }

        vessels[node.attrib.uniqueID] = vessel;
	
	console.log('Read Vessel ', node.attrib.uniqueID, factions[vessel.faction].name, vessel.classname);

    }
}

// console.log(vessels);
// console.log(vessels[0]);


exports.vessels  = vessels;
exports.factions = factions;

