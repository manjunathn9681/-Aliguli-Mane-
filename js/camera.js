/* =========================================================
   camera.js  —  Three.js camera & controls
   ========================================================= */
'use strict';

class CameraManager {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        
        // Initial setup
        this.camera.position.set(0, 16, 12);
        this.camera.lookAt(0, 0, 0);

        // Include OrbitControls from Three.js examples (loaded in index.html)
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.minDistance = 8;
            this.controls.maxDistance = 25;
            this.controls.maxPolarAngle = Math.PI / 2 - 0.1; // Don't go below ground
            this.controls.minPolarAngle = Math.PI / 6;       // Don't go too top-down
            
            // Limit azimuth (rotation around board)
            this.controls.minAzimuthAngle = -Math.PI / 3;
            this.controls.maxAzimuthAngle = Math.PI / 3;
            
            this.controls.enablePan = false; // Disable panning for fixed board view
        }
        
        this.isAnimating = false;
        this.animTargetPos = new THREE.Vector3();
        this.animTargetLook = new THREE.Vector3();
    }

    update() {
        if (this.controls && !this.isAnimating) {
            this.controls.update();
        }
    }

    // ── Animations ───────────────────────────────────────────
    
    // Focus on a specific pit (e.g. during a long move)
    focusOnPit(board, pitIndex) {
        const pitPos = board.getPitWorldPos(pitIndex);
        // Slightly offset towards the player side
        const zOffset = pitIndex < 7 ? 6 : -6; 
        
        this._animateCameraTo(
            new THREE.Vector3(pitPos.x, 10, pitPos.z + zOffset),
            new THREE.Vector3(pitPos.x, 0, pitPos.z)
        );
    }
    
    // Reset to default angled top-down
    resetView() {
        this._animateCameraTo(
            new THREE.Vector3(0, 16, 12),
            new THREE.Vector3(0, 0, 0)
        );
    }
    
    // Victory flyaround
    victorySpin() {
        this.isAnimating = true;
        if (this.controls) this.controls.enabled = false;
        
        const startPos = this.camera.position.clone();
        const lookAt = new THREE.Vector3(0,0,0);
        
        let t = 0;
        const radius = Math.sqrt(startPos.x*startPos.x + startPos.z*startPos.z);
        const startAngle = Math.atan2(startPos.z, startPos.x);
        const height = startPos.y;
        
        const animate = () => {
            if (!this.isAnimating) return; // cancelled
            t += 0.005; // speed
            
            const x = Math.cos(startAngle + t) * radius;
            const z = Math.sin(startAngle + t) * radius;
            
            this.camera.position.set(x, height, z);
            this.camera.lookAt(lookAt);
            
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }
    
    stopAnimation() {
        this.isAnimating = false;
        if (this.controls) {
            this.controls.enabled = true;
            this.controls.target.set(0,0,0); // reset look target for orbit
        }
    }

    _animateCameraTo(targetPos, targetLookAt) {
        this.isAnimating = true;
        if (this.controls) this.controls.enabled = false;
        
        const startPos = this.camera.position.clone();
        
        // We'll just interpolate position. 
        // For LookAt, we'll interpolate the direction.
        const startDir = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
        const endDir = targetLookAt.clone().sub(targetPos).normalize();

        let t = 0;
        const duration = 1.0; // seconds

        const update = () => {
            if (!this.isAnimating) return;
            t += 1 / (duration * 60);
            
            if (t >= 1) {
                this.camera.position.copy(targetPos);
                this.camera.lookAt(targetLookAt);
                this.stopAnimation();
                return;
            }
            
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in out quad
            
            this.camera.position.lerpVectors(startPos, targetPos, ease);
            
            const currDir = startDir.clone().lerp(endDir, ease).normalize();
            const lookTarget = this.camera.position.clone().add(currDir);
            this.camera.lookAt(lookTarget);
            
            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }
}

window.CameraManager = CameraManager;
