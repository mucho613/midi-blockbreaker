var midi = null;
var inputs = [];
var outputs = [];
var map;
var dotData;

var key;

var midiOutputSelect = document.getElementById("midi-output");

midiOutputSelect.addEventListener("change", (e) => {
	midiOutputIndex = midiOutputSelect.value;
});

var midiOutputIndex = 0;

promise = navigator.requestMIDIAccess({sysex: true});
promise.then(successCallback, errorCallback);

function successCallback(m) {
	midi = m;
	var it = midi.inputs.values();
	for(var o = it.next(); !o.done; o = it.next()){
		inputs.push(o.value);
	}
	var ot = midi.outputs.values();
	for(var o = ot.next(); !o.done; o = ot.next()){
		outputs.push(o.value);
		midiOutputSelect.innerHTML += '<option value="' + o.value.id.slice(-1) + '">' + o.value.name + '</option>'; 
	}
	for(var cnt=0;cnt < inputs.length;cnt++){
		inputs[cnt].onmidimessage = onMIDIEvent;
	}

	init();
}

function errorCallback() {
	console.error("Web MIDI API Initialize Error");
}

function beep(noteNumber, length) {
	outputs[midiOutputIndex].send([0x90, noteNumber, 100]);
	setTimeout(outputs[midiOutputIndex].send([0x90, noteNumber, 0]), length);
}

function onMIDIEvent(e){
	if(e.data[0] != 0xfe){
		console.log(e.data);
	}
}

function init(){
	map = new Array(16);
	for(i=0; i<16; i++){
		map[i] = new Array(16);
	}
	dotData = new Array(64);

	key = [false, false];
	document.addEventListener("keydown", (e) => {
		inPause = false;
		if(e.keyCode == 37) key[0] = true;
		if(e.keyCode == 39) key[1] = true;
	});
	document.addEventListener("keyup", (e) => {
		if(e.keyCode == 37) key[0] = false;
		if(e.keyCode == 39) key[1] = false;
	});

	gameStart();
}

function createField() {
	// Create field
	for(i=0; i<16; i++){
		for(j=0; j<16; j++){
			map[i][j] = 0;
		}
	}
	
	for(i=0; i<16; i++){
		for(j=0; j<16; j++){
			if(i%15==0 || j==0) map[i][j] = 2;
			if((3<i && i<12) && (3<j && j<7)) map[i][j] = 3;
		}
	}
}

function draw() {
	if(!inPause) {
		if(!updateField()) miss();
		if(rest == 0) {
			gameOver();
			gameStart();
			return;
		}
	}
	convertDotData();
	display();
	if(clearCheck()) {
		if(clear()) gameStart();
	}
	else {
		setTimeout(draw, 100);
	}
}

var rest;
var inPause;

function gameStart() {
	inPause = true;

	rest = 3;
	
	createField();

	initializeFieldState();

	convertDotData();
	display();

	draw();
}

function initializeFieldState() {
	ballPositionX = 5, ballPositionY = 11;
	ballVelocityX = 1, ballVelocityY = -1;

	barPositionX = 8, barLength = 4;
}

function miss() {
	initializeFieldState();
	rest--;
	if(rest != 0) sendString("Miss! Ball x" + rest);
	inPause = true;
}

function gameOver() {
	sendString("Game Over. Try again!");
}

function clear() {
	sendString("Game Clear!");
}

var byteArray;

function sendString(string) {
	byteArray = [];
	for(i=0; i<string.length; i++) {
		byteArray.push(string.charCodeAt(i));
	}
	// Calculate checksum
	var checksum = 0x10 + 0x00 + 0x00;
	for(i=0; i<byteArray.length; i++) {
		checksum += byteArray[i];
	}

	checksum = (128 - (checksum % 128)) % 128;
	outputs[midiOutputIndex].send([0xf0, 0x41, 0x10, 0x45, 0x12, 0x10, 0x00, 0x00].concat(byteArray).concat([checksum, 0xf7]));
}

function clearCheck() {
	for(i=0; i<16; i++) {
		for(j=0; j<16; j++) {
			if(map[i][j] == 3) return false;
		}
	}
	return true;
}

function convertDotData() {
	for(i=0; i<64; i++){
		dotData[i] = 0;
	}

	for(i=0; i<16; i++) {
		for(j=0; j<16; j++){
			if(map[i][j] != 0){
				dotData[Math.floor(i/5)*16 + j] = dotData[Math.floor(i/5)*16 + j] | (1 << 4 - (i%5));
			}
		}
	}
}

function display(){
	// Calculate checksum
	var checksum;
	checksum = 0x10 + 0x01 + 0x00;
	for(i=0; i<64; i++){
		checksum += dotData[i];
	}
	checksum = (128 - (checksum % 128)) % 128;

	outputs[midiOutputIndex].send([0xf0, 0x41, 0x10, 0x45, 0x12, 0x10, 0x01, 0x00].concat(dotData).concat([checksum, 0xf7]));
}

var ballPositionX = 5, ballPositionY = 11;
var ballVelocityX = 1, ballVelocityY = -1;

var barPositionX = 8, barLength = 4;
var barAreaMap;

function updateField() {
	if(ballPositionY == map[0].length - 1) {
	       	map[ballPositionX][ballPositionY] = 0;
		beep(36, 500);
		return false;
	}

	// Apply player's control
	if(barPositionX > 1){
		if(key[0]) barPositionX--;
	}
	if(barPositionX + barLength - 1 < 16){
		if(key[1]) barPositionX++;
	}

	barAreaMap = new Array(16);

	for(i=0; i<16; i++){
		if(i >= barPositionX && i <= barPositionX + barLength - 1) barAreaMap[i] = 4;
		else barAreaMap[i] = 0;
	}

	// Copy to map
	for(i=1; i<15; i++){
		if(map[i][14] != 1) map[i][14] = barAreaMap[i];
	}

	if(ballVelocityX > 0 && ballVelocityY > 0 &&
	map[ballPositionX + 1][ballPositionY + 1] != 0 &&
	map[ballPositionX + 1][ballPositionY] == 0 &&
	map[ballPositionX][ballPositionY + 1] == 0){
		ballVelocityX *= -1; ballVelocityY *= -1;
		if(map[ballPositionX + 1][ballPositionY + 1] == 3) {
			beep(72, 200);
			map[ballPositionX + 1][ballPositionY + 1] = 0;
		}
		else beep(60, 200);
	}
		
	if(ballVelocityX > 0 && ballVelocityY < 0 &&
	map[ballPositionX + 1][ballPositionY - 1] != 0 &&
	map[ballPositionX + 1][ballPositionY] == 0 &&
	map[ballPositionX][ballPositionY - 1] == 0){
		ballVelocityX *= -1; ballVelocityY *= -1;
		if(map[ballPositionX + 1][ballPositionY - 1] == 3) {
			beep(72, 200);
			map[ballPositionX + 1][ballPositionY - 1] = 0;
		}
		else beep(60, 200);
	}

	if(ballVelocityX < 0 && ballVelocityY > 0 &&
	map[ballPositionX - 1][ballPositionY + 1] != 0 &&
	map[ballPositionX - 1][ballPositionY] == 0 &&
	map[ballPositionX][ballPositionY + 1] == 0){
		ballVelocityX *= -1; ballVelocityY *= -1;
		if(map[ballPositionX - 1][ballPositionY + 1] == 3) {
			beep(72, 200);
			map[ballPositionX - 1][ballPositionY + 1] = 0;
		}
		else beep(60, 200);
	}

	if(ballVelocityX < 0 && ballVelocityY < 0 &&
	map[ballPositionX - 1][ballPositionY - 1] != 0 &&
	map[ballPositionX - 1][ballPositionY] == 0 &&
	map[ballPositionX][ballPositionY - 1] == 0){
		ballVelocityX *= -1; ballVelocityY *= -1;
		if(map[ballPositionX - 1][ballPositionY - 1] == 3) {
			beep(72, 200);
			map[ballPositionX - 1][ballPositionY - 1] = 0;
		}
		else beep(60, 200);
	}
	
	if(ballVelocityX > 0 && map[ballPositionX + 1][ballPositionY] != 0) {
		ballVelocityX *= -1;
		if(map[ballPositionX + 1][ballPositionY] == 3) {
			beep(72, 200);
			map[ballPositionX + 1][ballPositionY] = 0;
		}
		else beep(60, 200);
	}
	if(ballVelocityX < 0 && map[ballPositionX - 1][ballPositionY] != 0) {
		ballVelocityX *= -1;
		if(map[ballPositionX - 1][ballPositionY] == 3) {
			beep(72, 200);
			map[ballPositionX - 1][ballPositionY] = 0;
		}
		else beep(60, 200);
	}
	if(ballVelocityY > 0 && map[ballPositionX][ballPositionY + 1] != 0) {
		ballVelocityY *= -1;
		if(map[ballPositionX][ballPositionY + 1] == 3) {
			beep(72, 200);
			map[ballPositionX][ballPositionY + 1] = 0;
		}
		else beep(60, 200);
	}
	if(ballVelocityY < 0 && map[ballPositionX][ballPositionY - 1] != 0) {
		ballVelocityY *= -1;
		if(map[ballPositionX][ballPositionY - 1] == 3) {
			beep(72, 200);
			map[ballPositionX][ballPositionY - 1] = 0;
		}
		else beep(60, 200);
	}
	
	map[ballPositionX][ballPositionY] = 0;

	ballPositionX += ballVelocityX;
	ballPositionY += ballVelocityY;
	
	map[ballPositionX][ballPositionY] = 1;

	return true;
}
