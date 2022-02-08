var skeletonIsSelected = false;
var hasPlacedSkeleton = false;
var hasClickedSkeleton = false;
var hasSpawnedSkeleton = false;
var selectedSkeleton = undefined;

AFRAME.registerComponent('start-experience', {
    init: function () {
        console.log('scene loaded');
        document.querySelector('#menu-overlay').style.display = 'block';
    }
});

//used to make models transparent 
AFRAME.registerComponent('model-opacity', {
    schema: { default: 1.0 },
    init: function () {
        this.el.addEventListener('model-loaded', this.update.bind(this));
    },
    update: function () {
        var mesh = this.el.getObject3D('mesh');
        var data = this.data;
        if (!mesh) { return; }
        mesh.traverse(function (node) {
            if (node.isMesh) {
                node.material.opacity = data;
                node.material.transparent = data < 1.0;
                node.material.needsUpdate = true;
            }
        });
    }
});

AFRAME.registerComponent('update-skeleton-pos', {
    init: function () {
        this.el.addEventListener('raycaster-intersected', evt => {
            this.raycaster = evt.detail.el;
        });
        this.el.addEventListener('raycaster-intersected-cleared', evt => {
            this.raycaster = null;
        });
    },

    tick: function () {
        if (!this.raycaster) { return; }
        let intersection = this.raycaster.components.raycaster.getIntersection(this.el);
        if (!intersection) { return; }

        // setting the skeletons new position (clamped to not clip outside the room)
        selectedSkeleton.setAttribute('position', `${clamp(intersection.point.x, -8.5, 8.5)} 0 ${clamp(intersection.point.z, -8.5, 8.5)}`);
    }
});

AFRAME.registerComponent('delete-after-animation', {
    init: function () {
        this.el.addEventListener('animationcomplete__3', evt => {
            // deleting the entity now that the animation is done
            this.el.parentNode.removeChild(this.el);
        });
    }
});
function startExperience() {
    document.querySelector('#menu-overlay').style.display = 'none';
    const ambientSounds = document.querySelectorAll('.ambient-sounds');
    ambientSounds.forEach(e => {
        e.components.sound.playSound();
    });
}

// generates a random positive or negative number
function randNum(min, max, negative) {
    var num = (Math.random() * max) + min;
    if (negative) num *= Math.random() < 0.5 ? 1 : -1;
    return num;
}

function clamp(num, min, max) { return Math.min(Math.max(num, min), max); }

function pickUpFlashlight() {
    // deleting the flashlight item entity
    document.getElementById('flashlight_item').remove();

    // dimming the spotlight
    document.getElementById('flashlight_item_spotlight').setAttribute('animation', 'property:light.intensity; from:1; to:0; autoplay: true; dur:3000;');

    // updating the text 
    var flashlightPrompt = document.getElementById('flashlight_prompt');
    flashlightPrompt.setAttribute('text', 'font: mozillavr; value: Look around, peep the horror; width: 5; align: center;');
    flashlightPrompt.setAttribute('animation', 'property:text.opacity; from:1; to:0; autoplay: true; dur:4000; delay: 1000;');

    // animating the flashlight into view
    var flashlightGroup = document.getElementById('flashlight_inhand_group');
    flashlightGroup.setAttribute('visible', 'true');
    flashlightGroup.setAttribute('animation', 'property:position; from:0 -1 0; to:0 0 0; autoplay: true; dur:2000; easing: easeOutExpo;');
    flashlightGroup.setAttribute('animation__2', 'property:rotation; from:-90 0 0; to:0 0 0; autoplay: true; dur:1000; easing: easeOutExpo;');

    // playing the click sound effect
    var flashlightSound = document.createElement('a-entity');
    flashlightSound.setAttribute('sound', 'src: #flashlight_click_sound; autoplay: true; volume: 1.0;');
    flashlightGroup.appendChild(flashlightSound);

    var createHorrorGroup = document.getElementById('create_horror_group');
    var slideSound = document.createElement('a-entity');
    var createHorrorPrompt = document.getElementById('create_horror_prompt');
    slideSound.setAttribute('sound', 'src: #slide_sound; autoplay: true; volume: 1.0;');
    createHorrorGroup.appendChild(slideSound);
    createHorrorGroup.setAttribute('animation', 'property:position; from: 2 -3 2; to: 2 0 2; dur: 4000;');
    createHorrorPrompt.setAttribute('animation', 'property:text.opacity; from:1; to:0; autoplay: true; dur:4000; delay: 4000;');

}

function animateInRemoveButton() {
    var removeHorrorGroup = document.getElementById('remove_horror_group');
    var slideSound = document.createElement('a-entity');
    var removeHorrorPrompt = document.getElementById('remove_horror_prompt');
    slideSound.setAttribute('sound', 'src: #slide_sound; autoplay: true; volume: 1.0;');
    removeHorrorGroup.appendChild(slideSound);
    removeHorrorGroup.setAttribute('animation', 'property:position; from: -2 -3 2; to: -2 0 2; dur: 4000;');
    removeHorrorPrompt.setAttribute('animation', 'property:text.opacity; from:1; to:0; autoplay: true; dur:4000; delay: 20000;');
}

// moves and places a skeleton
function moveSkeleton(skeleton) {
    // getting the cursor
    var cursor = document.getElementById('cursor');
    // getting an array of all objects used as boundaries for the skeleton placement
    var placeableBoundaries = document.getElementsByClassName('move-boundary');
    if (!skeletonIsSelected) {
        skeletonIsSelected = true;
        skeleton.setAttribute('light', 'type: point; intensity: 0.75; distance: 50; decay: 2');
        skeleton.setAttribute('animation__2', 'property:model-opacity; from:0.5; to:0.3; dir: alternate; autoplay: true; dur:700; loop:true;');
        skeleton.setAttribute('id', 'selectedSkeleton');
        selectedSkeleton = skeleton;
        cursor.setAttribute('raycaster', 'far:20; interval:200; objects:.move-boundary;');
        for (let bound of placeableBoundaries) bound.setAttribute('update-skeleton-pos', '');

    } else if (skeleton.id === 'selectedSkeleton') {
        skeleton.removeAttribute('id');
        skeleton.removeAttribute('light');
        skeleton.setAttribute('animation__2', 'property:model-opacity; from:0.5; to:1; autoplay: true; loop:false; dur:500;');
        skeletonIsSelected = false;
        selectedSkeleton = undefined;
        cursor.setAttribute('raycaster', 'far:20; interval:200; objects:.interactive;');
        for (let bound of placeableBoundaries) bound.removeAttribute('update-skeleton-pos');
    }
}

// spawns a single skeleton
function spawnSkeleton() {
    // creating a skeleton
    var newSkeleton = document.createElement('a-entity');
    newSkeleton.className = "skeletons interactive";
    newSkeleton.setAttribute('gltf-model', '#skeleton_model');
    newSkeleton.setAttribute('scale', '0.7 0.7 0.7');
    // spawning the skeleton in a random spot within the room (past the button)
    let initPositionX = randNum(0, 9, true);
    let initPositionZ = randNum(3, 6, false);
    if(!hasSpawnedSkeleton) {
        // placing the "tutorial skeleton" in plain view
        initPositionX = 0;
        initPositionZ = 5;
    }
    newSkeleton.setAttribute('rotation', `0 180 0`);
    // creating initial animation for the skeleton
    newSkeleton.setAttribute('animation', `property:position; from:${initPositionX} -3 ${initPositionZ}; to:${initPositionX} 0 ${initPositionZ}; dir: alternate; autoplay: true; dur:700`);
    newSkeleton.setAttribute('position', `${initPositionX} 0 ${initPositionZ}`);
    newSkeleton.setAttribute('onclick', 'moveSkeleton(this)');
    // creating the sound
    var newSkeletonSound = document.createElement('a-entity');
    newSkeletonSound.className = "skeleton-sound";
    newSkeletonSound.setAttribute('sound', 'src: #skeleton_noise; autoplay: true; volume: 1.5;');
    // placing the skeleton and sound into the proper entity
    document.getElementById('skeleton_factory').appendChild(newSkeleton);
    newSkeleton.appendChild(newSkeletonSound);

    if(!hasSpawnedSkeleton) {
        hasSpawnedSkeleton = true;
        animateInRemoveButton();
        var moveSkeletonPrompt = document.createElement('a-entity');
        moveSkeletonPrompt.setAttribute('text', 'font: mozillavr; value: Click on a skeleton to move it. Click again to place.; width: 6; align: center;');
        moveSkeletonPrompt.setAttribute('animation', 'property:text.opacity; from:1; to:0; autoplay: true; dur:4000; delay: 10000;');
        moveSkeletonPrompt.setAttribute('position', '0 2 0.7');
        newSkeleton.appendChild(moveSkeletonPrompt);
    }
}

// begins the process of removing all skeletons
function removeAllSkeletons() {
    var allSkeletons = document.getElementsByClassName('skeletons');
    for (let skeleton of allSkeletons) {
        let skeletonPos = skeleton.getAttribute('position');
        skeleton.setAttribute('animation__3', `property:position; from:${skeletonPos.x} 0 ${skeletonPos.z}; to:${skeletonPos.x} -3 ${skeletonPos.z}; delay:${randNum(0, 2000, false)}; dir: linear; autoplay: true; dur:700;`);
        skeleton.setAttribute('delete-after-animation', '');
    }
}