/* =========================================================
   camera.js  —  Three.js camera & controls
   ========================================================= */
'use strict';

class CameraManager {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        
        this.isTopView = true;
        this.savedCameraState = { 
            pos: new THREE.Vector3(0, 16, 12), 
            target: new THREE.Vector3(0, 0, 0) 
        };

        // Calculate perfect top-down height based on screen
        const topY = this.getOptimalTopHeight();
        this.camera.position.set(0, topY, 0);
        this.camera.lookAt(0, 0, 0);

        // Include OrbitControls from Three.js examples
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.minDistance = 8;
            this.controls.maxDistance = 35;
            this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
            this.controls.minPolarAngle = 0; // Allow perfect top down
            
            this.controls.minAzimuthAngle = -Math.PI / 3;
            this.controls.maxAzimuthAngle = Math.PI / 3;
            
            this.controls.enablePan = false; // Never pan away from center
            this.controls.enableRotate = false; // Locked in Top View initially
        }
        
        this.isAnimating = false;
        this.animTargetPos = new THREE.Vector3();
        this.animTargetLook = new THREE.Vector3();
    }

    getOptimalTopHeight() {
        const aspect = window.innerWidth / window.innerHeight;
        // Board is approx 18 units wide, 8 units deep (with margins)
        const fovRad = (this.camera.fov * Math.PI) / 180;
        const heightForWidth = (18 / 2) / Math.tan(fovRad / 2) / aspect;
        const heightForDepth = (8 / 2) / Math.tan(fovRad / 2);
        
        let targetHeight = Math.max(heightForWidth, heightForDepth);
        return Math.max(15, Math.min(targetHeight, 35));
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
    
    // Reset to default top-down
    resetView() {
        this.isTopView = true;
        this._animateCameraTo(
            new THREE.Vector3(0, this.getOptimalTopHeight(), 0),
            new THREE.Vector3(0, 0, 0)
        );
    }
    
    // Toggle Top View
    toggleTopView(onToggleComplete) {
        if (this.isTopView) {
            // Restore previous 3D view
            this._animateCameraTo(this.savedCameraState.pos, this.savedCameraState.target, 0.6, () => {
                this.isTopView = false;
                this.stopAnimation(false);
                if (onToggleComplete) onToggleComplete(false);
            });
        } else {
            // Save current 3D view
            this.savedCameraState.pos.copy(this.camera.position);
            if (this.controls) {
                this.savedCameraState.target.copy(this.controls.target);
            } else {
                this.savedCameraState.target.copy(this.camera.position).add(new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion));
            }

            // Animate to top view
            const topPos = new THREE.Vector3(0, this.getOptimalTopHeight(), 0); // Straight up, fitted to screen
            const topLookAt = new THREE.Vector3(0, 0, 0);

            this._animateCameraTo(topPos, topLookAt, 0.6, () => {
                this.isTopView = true;
                this.stopAnimation(); // Handled by stopAnimation checking isTopView
                if (onToggleComplete) onToggleComplete(true);
            });
        }
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
            this.controls.enablePan = false;
            
            if (this.isTopView) {
                this.controls.enableRotate = false;
            } else {
                this.controls.enableRotate = true;
            }
            this.controls.target.set(0, 0, 0); // Always keep board centered
        }
    }

    _animateCameraTo(targetPos, targetLookAt, duration = 1.0, onComplete = null) {
        this.isAnimating = true;
        if (this.controls) this.controls.enabled = false;
        
        const startPos = this.camera.position.clone();
        
        // We'll just interpolate position. 
        // For LookAt, we'll interpolate the direction.
        const startDir = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
        const endDir = targetLookAt.clone().sub(targetPos).normalize();

        let t = 0;

        const update = () => {
            if (!this.isAnimating) return;
            t += 1 / (duration * 60);
            
            if (t >= 1) {
                this.camera.position.copy(targetPos);
                this.camera.lookAt(targetLookAt);
                if (onComplete) {
                    onComplete();
                } else {
                    this.stopAnimation();
                }
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
