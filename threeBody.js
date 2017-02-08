// Richard McNew
// CS 5400
// Assignment 06:  Three Body
//
// "Write a program that shows a simulation of a 3 body particle system (i.e. Sun-Earth-Moon).  
// User interface should include ability to modify various system parameters such as mass, velocity, and position of the three particles.  
// UI should also have controls for changing view parameters to allow the user to explore the system"
//
// Due Dec 7 by 11:59pm

// Globals
var scene;
var camera;
var renderer;
var sunLight;
var ambiLight;
var textureLoader;
var cameraAnimateTween;
var cameraMoveTo;
var cameraAngle;
var cameraRotationAxis;
var astroUpdateCount = 0;
var astroMovementEnabled = false;

// Gravitational constant
const G = 6.67408e-11; // m^3 kg^-1 s^-2 == N m^2 kg^-2

const COUNT = 90;
const FRAMES = 200;
const CAMERA_ROTATE = 100; 
const CAMERA_MOVE = 2;  // WebGL units
const ASTRO_UPDATE_FREQ = 10;
const HEIGHT_SCALE = 0.65;
const WIDTH_SCALE = 0.88;

var sun;
var earth;
var moon;
var sunMaterial;
var earthMaterial;
var earthBumpMap = false;
var moonMaterial;
var earthAnimateTween;
var earthMoveTo;
var moonAnimateTween;
var moonMoveTo;

THREE.Vector3.prototype.toString = function Vector3ToString() {
	return "Vector3 {x: " + this.x + ", y: " + this.y + ", z: " + this.z + "}";
}

function initScene() {
	// scene 
	scene = new THREE.Scene();
	// camera 
	camera = new THREE.PerspectiveCamera( 45, (window.innerWidth * WIDTH_SCALE)/(window.innerHeight * HEIGHT_SCALE), 0.1, 10000000 );
    camera.rotation.reorder('YXZ');
	// renderer
	renderer = new THREE.WebGLRenderer();
	renderer.setSize( (window.innerWidth * WIDTH_SCALE), (window.innerHeight * HEIGHT_SCALE) );
	renderer.shadowMapEnabled = true;
	document.body.appendChild( renderer.domElement );
	// lighting
	sunLight = new THREE.PointLight( 0xffffff, 700, 1500, 2);
	sunLight.position.set(0, 0, 0);
	sunLight.castShadow = true;
	scene.add(sunLight);
	ambiLight = new THREE.AmbientLight( 0x888888 );
	scene.add(ambiLight);
    // texture loader
	textureLoader = new THREE.TextureLoader();
}

function getParameter(paramId) {
    return parseFloat(document.getElementById(paramId).value);
}

function setParameter(paramId, val) {
    document.getElementById(paramId).value = val; 
}

function getSunParameters() {
    var sunMass = getParameter("sunMass");
    var sunRadius = getParameter("sunRadius");
    return {
		"sunMass": sunMass, 
		"sunRadius": sunRadius
	};
}

function getEarthParameters() {
	var earthMass = getParameter("earthMass");
	var earthRadius = getParameter("earthRadius");
	var earthDistanceFromSun = getParameter("earthDistanceFromSun");
	var earthVelocity = getParameter("earthVelocity");
	return { 
		"earthMass": earthMass,
		"earthRadius": earthRadius,
		"earthDistanceFromSun": earthDistanceFromSun,
		"earthVelocity": earthVelocity
	};
}

function getMoonParameters() {
	var moonMass = getParameter("moonMass");
	var moonRadius = getParameter("moonRadius");
	var moonDistanceFromEarth = getParameter("moonDistanceFromEarth");
	var moonVelocity = getParameter("moonVelocity");
	return { 
		"moonMass": moonMass,
		"moonRadius": moonRadius,
		"moonDistanceFromEarth": moonDistanceFromEarth,
		"moonVelocity": moonVelocity
	};
}

function applyAstroBodyParameters() {
	var sunParameters = getSunParameters();
	var earthParameters = getEarthParameters();
	var moonParameters = getMoonParameters();
	sun.updateParameters(sunParameters.sunRadius, sunParameters.sunMass, 
						 new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
	earth.updateParameters(earthParameters.earthRadius, earthParameters.earthMass, 
						   earth.mesh.position.normalize().multiplyScalar(earthParameters.earthDistanceFromSun), 
						   earth.velocity.normalize().multiplyScalar(earthParameters.earthVelocity) );
	moon.updateParameters(moonParameters.moonRadius, moonParameters.moonMass, 
						  moon.mesh.position.normalize().multiplyScalar(earthParameters.earthDistanceFromSun + moonParameters.moonDistanceFromEarth), 
						  moon.velocity.normalize().multiplyScalar(moonParameters.moonVelocity) );
    updateSunLight();
}


function resetAllParameters() {
    setParameter("sunMass", 1.989e30);
    setParameter("sunRadius", 6.957e8);
    setParameter("earthMass", 5.972e24);
    setParameter("earthRadius", 6.371e6);
    setParameter("earthDistanceFromSun", 1.496e11);
    setParameter("earthVelocity", 3.0e5);
    setParameter("moonMass", 7.34767309e22);
    setParameter("moonRadius", 1.737e6);
    setParameter("moonDistanceFromEarth", 3.844e8);
    setParameter("moonVelocity", 1.023056e3);
	setParameter("warpFactor", 1);
	applyAstroBodyParameters();
}

function applyTinyParameters() {
    setParameter("sunMass", 1.989e14);
    setParameter("sunRadius", 6.957);
    setParameter("earthMass", 9.42e11);
    setParameter("earthRadius", 3);
    setParameter("earthDistanceFromSun", 90);
    setParameter("earthVelocity", 12);
    setParameter("moonMass", 9.1e8);
    setParameter("moonRadius", 1);
    setParameter("moonDistanceFromEarth", 5);
    setParameter("moonVelocity", 8.25);
	setParameter("warpFactor", 1);
	applyAstroBodyParameters();
    jumpToOverheadView();
}

function toggleAstroMovement() {
    astroMovementEnabled = !astroMovementEnabled;
}

class AstroBody {
    constructor(name, material, radius, mass, positionVec, velocityVec) {
        this.geometry = new THREE.SphereGeometry(radius, COUNT, COUNT);
        this.material = material; // save for future use in updateParameters
        this.radius = radius;
        this.name = name;
		console.log(name + " has radius " + radius);
        this.mesh = new THREE.Mesh(this.geometry, material);
        this.mesh.name = name;
        this.mass = mass;
        this.mesh.position.copy(positionVec);
		console.log(name + " is at position " + this.mesh.position );
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
		scene.add(this.mesh);
		this.velocity = new THREE.Vector3().copy(velocityVec);
        this.acceleration = new THREE.Vector3();
    }
	
	updateParameters(radius, mass, positionVec, velocityVec) {
        console.log("received velocityVec: " + velocityVec);
        console.log("velocity before update: " + this.velocity);
        this.radius = radius;
        this.mass = mass;
		this.velocity.copy(velocityVec);
        console.log("velocity after update: " + this.velocity);
        // remove the current mesh
        scene.remove(this.mesh);
        this.geometry = new THREE.SphereGeometry(radius, COUNT, COUNT);
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.name = this.name;
        this.mesh.position.copy(positionVec);
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
        // add the new mesh
		scene.add(this.mesh);
	}
}

function updateSunLight() {
	var sunEarthDistance = sun.mesh.position.distanceTo(earth.mesh.position) * 0.95;
	sunLight.distance = sunEarthDistance;
}

function calculateGravitationalForce(astro1, astro2) {
	var distance = astro1.mesh.position.distanceTo(astro2.mesh.position);
	var forceMagnitude = (G * astro1.mass * astro2.mass) / (distance * distance);
	return forceMagnitude;
}

function updateAstroBodies() {
	//console.log("start updateAstroBodies: ");
	printPositions();
	printVelocities();
	// sun - earth
	var sunEarthForce = calculateGravitationalForce(sun, earth);
	//console.log("sunEarthForce is: " + sunEarthForce);
    var sunPosition = new THREE.Vector3().copy(sun.mesh.position);
	var earthToSun = sunPosition.sub(earth.mesh.position).normalize().multiplyScalar(sunEarthForce);
	//console.log("earthToSun force vector is: " + earthToSun);

	// sun - moon
	var sunMoonForce = calculateGravitationalForce(sun, moon);
	//console.log("sunMoonForce is: " + sunMoonForce);
    var sunPosition2 = new THREE.Vector3().copy(sun.mesh.position);
	var moonToSun = sunPosition2.sub(moon.mesh.position).normalize().multiplyScalar(sunMoonForce);
	//console.log("moonToSun force vector is: " + moonToSun);

	// earth - moon
	var earthMoonForce = calculateGravitationalForce(earth, moon);
	//console.log("earthMoonForce is: " + earthMoonForce);
    var earthPosition = new THREE.Vector3().copy(earth.mesh.position);
	var moonToEarth = earthPosition.sub(moon.mesh.position).normalize().multiplyScalar(earthMoonForce);
	//console.log("moonToEarth force vector is: " + moonToEarth);
    var earthToMoon = new THREE.Vector3().copy(moonToEarth);
	earthToMoon.negate();
	//console.log("earthToMoon force vector is: " + earthToMoon);

	// total forces on earth
    var earthForce = new THREE.Vector3();
	earthForce.copy(earthToSun);
	earthForce.add(earthToMoon);
	//console.log("total earthForce vector is: " + earthForce);

	// total forces on moon
    var moonForce = new THREE.Vector3();
	moonForce.copy(moonToSun);
	moonForce.add(moonToEarth);
	//console.log("total moonForce vector is: " + moonForce);

	// ignore sun acceleration; treat the sun as immobile 

	// update earth acceleration
	earth.acceleration = earthForce.divideScalar(earth.mass);
	//console.log("earth acceleration vector is: " + earth.acceleration);
    // update earth velocity
    earth.velocity.add(earth.acceleration); 
    //console.log("updated earth velocity is: " + earth.velocity);
    // update earth position
    earthMoveTo = new THREE.Vector3().copy(earth.mesh.position);
	earthMoveTo.add(earth.velocity);
    //console.log("earth target position is: " + earthMoveTo);

	// update moon acceleration 
	moon.acceleration = moonForce.divideScalar(moon.mass);
	//console.log("moon acceleration vector is: " + moon.acceleration);
    // update moon velocity
    moon.velocity.add(moon.acceleration);
    //console.log("updated moon velocity is: " + moon.velocity);
    // update moon position
    moonMoveTo = new THREE.Vector3().copy(moon.mesh.position);
	moonMoveTo.add(moon.velocity);
    //console.log("moon target position is: " + moonMoveTo);
	updateSunLight();
    // start movements
	earthAnimateTween = new TWEEN.Tween(earth.mesh.position).to({x: earthMoveTo.x, y: earthMoveTo.y, z: earthMoveTo.z}, FRAMES).start();
	moonAnimateTween = new TWEEN.Tween(moon.mesh.position).to({x: moonMoveTo.x, y: moonMoveTo.y, z: moonMoveTo.z}, FRAMES).start();
}

function buildAstroBodies() {
    // sun
    var sunParams = getSunParameters();
    sun = new AstroBody("sun", sunMaterial, sunParams.sunRadius, 
											sunParams.sunMass, 
											new THREE.Vector3(0, 0, 0), 
											new THREE.Vector3(0, 0, 0) );
    sun.mesh.emissive = new THREE.Color(1, 1, 1);

    // earth
    var earthParams = getEarthParameters();
    earth = new AstroBody("earth", earthMaterial, earthParams.earthRadius, 
												  earthParams.earthMass, 
                          						  new THREE.Vector3(0, 0, earthParams.earthDistanceFromSun),  
                          						  new THREE.Vector3(earthParams.earthVelocity, 0, 0) );
    // moon
    var moonParams = getMoonParameters();
    moon = new AstroBody("moon", moonMaterial, moonParams.moonRadius, 
											   moonParams.moonMass, 
                         new THREE.Vector3(0, 0, (earthParams.earthDistanceFromSun + moonParams.moonDistanceFromEarth)),
                         new THREE.Vector3(moonParams.moonVelocity, 0, 0) );
}

function allTexturesLoaded() {
	if (sunMaterial && earthMaterial && earthBumpMap && moonMaterial) {
        console.log("All textures loaded!");
        buildAstroBodies();
		jumpToEarth();
		camera.lookAt(earth.mesh.position);
        render();
	} else {
        console.log("Waiting for remaining textures to load . . .");
    }
}

function loadTextures() {
	textureLoader.load("sun.jpg", sunTextureLoadSuccess, sunTextureLoadProgress, sunTextureLoadError);
	textureLoader.load("earth.jpg", earthTextureLoadSuccess, earthTextureLoadProgress, earthTextureLoadError);
    // earth bump map is loaded in earthTextureLoadSuccess
	textureLoader.load("moon.jpg", moonTextureLoadSuccess, moonTextureLoadProgress, moonTextureLoadError);
}

function sunTextureLoadSuccess( texture ) {  
	sunMaterial = new THREE.MeshPhongMaterial( {map: texture} ); 
    allTexturesLoaded();
}

function sunTextureLoadProgress( xhr ) {
	console.log( 'Sun texture ' + (xhr.loaded / xhr.total * 100) + '% loaded' );
}

function sunTextureLoadError( xhr ) {
	console.log( 'An error occurred while loading the Sun texture' );
}

function earthTextureLoadSuccess( texture ) {  
	earthMaterial = new THREE.MeshPhongMaterial( {map: texture} ); 
	textureLoader.load("earthBumpMap.jpg", earthBumpMapTextureLoadSuccess, earthBumpMapTextureLoadProgress, earthBumpMapTextureLoadError);
    allTexturesLoaded();
}

function earthTextureLoadProgress( xhr ) {
	console.log( 'Earth texture ' + (xhr.loaded / xhr.total * 100) + '% loaded' );
}

function earthTextureLoadError( xhr ) {
	console.log( 'An error occurred while loading the Earth texture' );
}

function earthBumpMapTextureLoadSuccess( bumpMap ) {  
	earthMaterial.bumpMap = bumpMap; 
    earthBumpMap = true;
    allTexturesLoaded();
}

function earthBumpMapTextureLoadProgress( xhr ) {
	console.log( 'Earth bump map texture ' + (xhr.loaded / xhr.total * 100) + '% loaded' );
}

function earthBumpMapTextureLoadError( xhr ) {
	console.log( 'An error occurred while loading the Earth bump map texture' );
}

function moonTextureLoadSuccess( texture ) {  
	moonMaterial = new THREE.MeshPhongMaterial( {map: texture} ); 
    allTexturesLoaded();
}

function moonTextureLoadProgress( xhr ) {
	console.log( 'Moon texture ' + (xhr.loaded / xhr.total * 100) + '% loaded' );
}

function moonTextureLoadError( xhr ) {
	console.log( 'An error occurred while loading the Moon texture' );
}

function jumpToSun() {
	var radius = sun.radius;
	var position = sun.mesh.position;
	camera.position.set(position.x, position.y, position.z + (2.5 * radius));	
	camera.lookAt(sun.mesh.position);
    console.log("Jumped near sun.  Sun position is: " + sun.mesh.position + ".  Camera position is: " + camera.position);
}

function jumpToEarth() {
	var radius = earth.radius;
	var position = earth.mesh.position;
	camera.position.set(position.x, position.y, position.z + (2.5 * radius));	
	camera.lookAt(earth.mesh.position);
    console.log("Jumped near earth.  Earth position is: " + earth.mesh.position + ".  Camera position is: " + camera.position);
}

function jumpToMoon() {
	var radius = moon.radius;
	var position = moon.mesh.position;
	camera.position.set(position.x, position.y, position.z + (2.5 * radius));	
	camera.lookAt(moon.mesh.position);
    console.log("Jumped near moon.  Moon position is: " + moon.mesh.position + ".  Camera position is: " + camera.position);
}

function jumpToOverheadView() {
	// grab the sun position since we base the overhead view on the sun's location
	var sunPosition = sun.mesh.position;
	// calculate the distance from sun to overhead view as 
    // (* (distance sun moon) (tan 67.5 degrees)) 
	var sunEarthDistance = sun.mesh.position.distanceTo(earth.mesh.position);
	var earthMoonDistance = earth.mesh.position.distanceTo(moon.mesh.position);
	var maxSunMoonDistance = sunEarthDistance + earthMoonDistance;
	var sunCameraDistance = maxSunMoonDistance * Math.tan(1.178097) * 1.1; // 67.5 degrees
	camera.position.set(sunPosition.x, sunPosition.y + sunCameraDistance, sunPosition.z);
	camera.lookAt(sunPosition);
}

function lookAtSun() {
	camera.lookAt(sun.mesh.position);
    console.log("Looking at sun with position: " + sun.mesh.position);
}

function lookAtEarth() {
	camera.lookAt(earth.mesh.position);
    console.log("Looking at earth with position: " + earth.mesh.position);
}

function lookAtMoon() {
	camera.lookAt(moon.mesh.position);
    console.log("Looking at moon with position: " + moon.mesh.position);
}

function printPositions() {
	console.log("Earth position: " + earth.mesh.position + ", Moon position: " + moon.mesh.position);
}

function printVelocities() {
	console.log("Earth velocity: " + earth.velocity + ", Moon velocity: " + moon.velocity);
}

var render = function() {
	requestAnimationFrame( render );
	TWEEN.update();
    if (astroMovementEnabled) {
        astroUpdateCount++;
    }
	if (astroUpdateCount === ASTRO_UPDATE_FREQ) {
		astroUpdateCount = 0;
    	updateAstroBodies();
    }
	renderer.render(scene, camera);
};

document.onkeydown = checkKey;

function checkKey(e) {
    e = e || window.event;

    var focused = document.activeElement;
    if (!focused || focused == document.body) {
        focused = null;
    } else if (document.querySelector) {
        focused = document.querySelector(":focus");
    }
    if (focused === null || (focused !== null && focused.constructor.name !== "HTMLInputElement")) {
        
        switch (e.key) {
            // Rotation keys
            case "ArrowLeft": // left arrow - rotate left
                cameraAngle = 0;
                cameraRotateAxis = camera.up;
                cameraAnimateTween = new TWEEN.Tween({cam: cameraAngle})
                .to({cam: CAMERA_ROTATE}, FRAMES)
                .onUpdate( function() {
                    camera.rotateOnAxis(cameraRotateAxis, THREE.Math.degToRad(CAMERA_ROTATE/FRAMES * getParameter("warpFactor") ));
                })
                .start(); 
                break;
            case "ArrowUp": // up arrow - rotate down
                cameraAngle = 0;
                cameraRotateAxis = camera.getWorldDirection().cross(camera.up);
                cameraAnimateTween = new TWEEN.Tween({cam: cameraAngle})
                .to({cam: CAMERA_ROTATE}, FRAMES)
                .onUpdate( function() {
                    camera.rotateOnAxis(cameraRotateAxis, THREE.Math.degToRad(CAMERA_ROTATE/FRAMES * getParameter("warpFactor") ));
                })
                .start(); 
                break;
            case "ArrowRight": // right arrow - rotate right
                cameraAngle = 0;
                cameraRotateAxis = camera.up;
                cameraAnimateTween = new TWEEN.Tween({cam: cameraAngle})
                .to({cam: CAMERA_ROTATE}, FRAMES)
                .onUpdate( function() {
                    camera.rotateOnAxis(cameraRotateAxis, -THREE.Math.degToRad(CAMERA_ROTATE/FRAMES * getParameter("warpFactor") ));
                })
                .start(); 
                break;
            case "ArrowDown": // down arrow - rotate up
                cameraAngle = 0;
                cameraRotateAxis = camera.getWorldDirection().cross(camera.up);
                cameraAnimateTween = new TWEEN.Tween({cam: cameraAngle})
                .to({cam: CAMERA_ROTATE}, FRAMES)
                .onUpdate( function() {
                    camera.rotateOnAxis(cameraRotateAxis, -THREE.Math.degToRad(CAMERA_ROTATE/FRAMES * getParameter("warpFactor") ));
                })
                .start(); 
                break; 
            // Translate keys
            case "W":
            case "w":
                cameraMoveTo = camera.getWorldDirection().multiplyScalar(CAMERA_MOVE * getParameter("warpFactor")).add(camera.position);
                cameraAnimateTween = new TWEEN.Tween(camera.position)
                .to({x: cameraMoveTo.x, y: cameraMoveTo.y, z: cameraMoveTo.z}, FRAMES).start();
                break;
            case "A":
            case "a":
                cameraMoveTo = camera.getWorldDirection().cross(camera.up).negate().multiplyScalar(CAMERA_MOVE * getParameter("warpFactor")).add(camera.position);
                cameraAnimateTween = new TWEEN.Tween(camera.position)
                .to({x: cameraMoveTo.x, y: cameraMoveTo.y, z: cameraMoveTo.z}, FRAMES).start();
                break;
            case "S":
            case "s":
                cameraMoveTo = camera.getWorldDirection().negate().multiplyScalar(CAMERA_MOVE * getParameter("warpFactor")).add(camera.position);
                cameraAnimateTween = new TWEEN.Tween(camera.position)
                .to({x: cameraMoveTo.x, y: cameraMoveTo.y, z: cameraMoveTo.z}, FRAMES).start();
                break;
            case "D":
            case "d":
                cameraMoveTo = camera.getWorldDirection().cross(camera.up).multiplyScalar(CAMERA_MOVE * getParameter("warpFactor")).add(camera.position);
                cameraAnimateTween = new TWEEN.Tween(camera.position)
                .to({x: cameraMoveTo.x, y: cameraMoveTo.y, z: cameraMoveTo.z}, FRAMES).start();
                break;
            // "Jump To" keys
            case "B":
            case "b":
                jumpToSun();
                break;
            case "N":
            case "n":
                jumpToEarth();
                break;
            case "M":
            case "m":
                jumpToMoon();
                break;
            case "V":
            case "v":
                jumpToOverheadView();
                break;
            // "Look At" keys
            case "J":
            case "j":
                lookAtSun();
                break;
            case "K":
            case "k":
                lookAtEarth();
                break;
            case "L":
            case "l":
                lookAtMoon();
                break;
            // Follow keys
            case "I":
            case "i": 
                followSun();
                break;
            case "O":
            case "o":
                followEarth();
                break;
            case "P":
            case "p":
                followMoon();
                break;
        }
    }
}


initScene();
loadTextures();
