/*
MIT License

2024, Cyril Monkewitz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// Constants and variables
let GRAVITY = 9.81 * 100; // m/s^2
let AIR_DENSITY = 0.0014; // kg/m^3
let DRAG_COEFFICIENT = 0.05; // for a sphere
let ROTATIONAL_DRAG_COEFFICIENT = 0.01;
let CANVAS_WIDTH = window.innerWidth;
let CANVAS_HEIGHT = window.innerHeight;


export function setGravity(value) {
    GRAVITY = value * 100;
}

export function setAirDensity(value) {
    AIR_DENSITY = value;
}

export function setDragCoefficient(value) {
    DRAG_COEFFICIENT = value;
}

export function setRotationalDragCoefficient(value) {
    ROTATIONAL_DRAG_COEFFICIENT = value;
}

// Utility function to generate a random integer between min and max (inclusive)
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Ball class
export class Ball {
    constructor(x, y, radius, mass, color, vx = 0, vy = 0) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.mass = mass;
        this.color = color;
        this.vx = vx;
        this.vy = vy;
        this.angularVelocity = 0;
        this.rotation = 0;
        this.selected = false;
        this.momentOfInertia = 0.5 * mass * radius * radius; // For a solid disk
        this.drawFunction = this.generateDrawFunction();
    }

    applyForce(fx, fy, dt) {
        const ax = fx / this.mass;
        const ay = fy / this.mass;
        this.vx += ax * dt;
        this.vy += ay * dt;
    }

    update(dt) {
        if (!this.selected) {
            // Apply gravity
            if (GRAVITY !== 0) {
                this.applyForce(0, this.mass * GRAVITY, dt);
            }

            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > 0) {
                // Apply linear drag force
                const dragMagnitude = 0.5 * AIR_DENSITY * speed * DRAG_COEFFICIENT * Math.PI * this.radius * this.radius;
                const dragForceX = -dragMagnitude * this.vx / speed;
                const dragForceY = -dragMagnitude * this.vy / speed;
                this.applyForce(dragForceX, dragForceY, dt);

                // Apply Magnus effect
                const magnusConstant = 1 / (2 * Math.PI);
                const magnusMagnitude = magnusConstant * this.angularVelocity * this.radius * AIR_DENSITY * speed;
                const magnusForceX = magnusMagnitude * -this.vy / speed;
                const magnusForceY = magnusMagnitude * this.vx / speed;
                this.applyForce(magnusForceX, magnusForceY, dt);

                // Calculate the work done by the Magnus force
                const magnusForce = Math.sqrt(magnusForceX * magnusForceX + magnusForceY * magnusForceY);
                const distanceTraveled = speed * dt;
                const workDone = magnusForce * distanceTraveled;

                // Convert the work done into a reduction in kinetic energy
                const kineticEnergyLoss = workDone;
                const currentKineticEnergy = 0.5 * this.mass * (this.vx * this.vx + this.vy * this.vy);

                // Ensure we don't remove more energy than the current kinetic energy
                const newKineticEnergy = Math.max(0, currentKineticEnergy - kineticEnergyLoss);

                // Calculate the new speed and adjust the velocities accordingly
                const newSpeed = Math.sqrt((2 * newKineticEnergy) / this.mass);
                const speedRatio = newSpeed / speed;
                this.vx *= speedRatio;
                this.vy *= speedRatio;
            }

            // Apply rotational drag
            const rotationalDragTorque = -ROTATIONAL_DRAG_COEFFICIENT * AIR_DENSITY * Math.PI * Math.pow(this.radius, 4) * this.angularVelocity * Math.abs(this.angularVelocity);
            this.angularVelocity += (rotationalDragTorque / this.momentOfInertia) * dt;

            // Update position
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            // Update rotation
            this.rotation += this.angularVelocity * dt;
        }

        // Handle wall collisions
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            handleWallCollision(this, 1, 0);
        } else if (this.x + this.radius > CANVAS_WIDTH) {
            this.x = CANVAS_WIDTH - this.radius;
            handleWallCollision(this, -1, 0);
        }
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            handleWallCollision(this, 0, 1);
        } else if (this.y + this.radius > CANVAS_HEIGHT) {
            this.y = CANVAS_HEIGHT - this.radius;
            handleWallCollision(this, 0, -1);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.selected) {
            // Draw neon green glow
            ctx.shadowColor = '#ffa800';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }

        this.drawFunction(ctx);

        ctx.restore();
    }

    generateDrawFunction() {
        const type = getRandomInt(1, 8); // Choose a random type of pattern
        switch (type) {
            case 1:
                return this.drawFlowerPattern(false);
            case 2:
                return this.drawFlowerPattern(true);
            case 3:
                return this.drawStarPattern(false);
            case 4:
                return this.drawStarPattern(true);
            case 5:
                return this.drawSwirlPattern();
            case 6:
                return this.drawCirclePattern(false);
            case 7:
                return this.drawCirclePattern(true);
            default:
                return this.drawFlowerPattern(false);
        }
    }

    drawFlowerPattern(outlineOnly) {
        const petals = getRandomInt(5, 10);
        const petalRadius = this.radius / 2;
        return (ctx) => {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
            gradient.addColorStop(0, '#000000');
            gradient.addColorStop(1, this.color);
            ctx.strokeStyle = gradient;
            ctx.fillStyle = gradient;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < petals; i++) {
                const angle = (i * 2 * Math.PI) / petals;
                const petalStartX = (this.radius - petalRadius) * Math.cos(angle);
                const petalStartY = (this.radius - petalRadius) * Math.sin(angle);
                const startAngle = angle - Math.PI / petals;
                const endAngle = angle + Math.PI / petals;
                ctx.moveTo(petalStartX, petalStartY);
                ctx.arc(petalStartX, petalStartY, petalRadius, startAngle, endAngle);
                ctx.lineTo(petalStartX, petalStartY);
            }
            ctx.closePath();
            if (outlineOnly) {
                ctx.stroke();
            } else {
                ctx.fill();
            }
        };
    }

    drawStarPattern(outlineOnly) {
        const points = getRandomInt(5, 10);
        const innerRadius = this.radius / 2;
        return (ctx) => {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
            gradient.addColorStop(0, '#000000');
            gradient.addColorStop(1, this.color);
            ctx.strokeStyle = gradient;
            ctx.fillStyle = gradient;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < points; i++) {
                const angle = (i * 2 * Math.PI) / points;
                ctx.lineTo(this.radius * Math.cos(angle), this.radius * Math.sin(angle));
                ctx.lineTo(innerRadius * Math.cos(angle + Math.PI / points), innerRadius * Math.sin(angle + Math.PI / points));
            }
            ctx.closePath();
            if (outlineOnly) {
                ctx.stroke();
            } else {
                ctx.fill();
            }
        };
    }

    drawSwirlPattern() {
        const swirls = getRandomInt(2, 5);
        return (ctx) => {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
            gradient.addColorStop(0, this.color);
            gradient.addColorStop(1, '#000000');
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < swirls; i++) {
                const angle = (i * 2 * Math.PI) / swirls;
                ctx.moveTo(0, 0);
                for (let j = 0; j < this.radius; j++) {
                    const x = j * Math.cos(angle + (j / this.radius) * 2 * Math.PI);
                    const y = j * Math.sin(angle + (j / this.radius) * 2 * Math.PI);
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        };
    }

    drawCirclePattern(outlineOnly) {
        return (ctx) => {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
            gradient.addColorStop(0, '#000000');
            gradient.addColorStop(1, this.color);
            ctx.fillStyle = gradient;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.closePath();
            if (outlineOnly) {
                ctx.stroke();
				// Draw a line to show rotation
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(this.radius, 0);
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.fill();
                // Draw a line to show rotation
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(this.radius, 0);
                ctx.strokeStyle = '#121212'; // Background color
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        };
    }
}

export function clamp(min, max, value) {
    return Math.max(min, Math.min(max, value));
}

export function handleWallCollision(ball, normalX, normalY) {
    const [nx, ny] = [normalX, normalY];
    const tx = -ny, ty = nx;

    const vn = ball.vx * nx + ball.vy * ny;
    const vt = ball.vx * tx + ball.vy * ty;

    if (vn < 0) {
        const restitution = 0.8; // Adjust this value to control the elasticity of the collision
        const j = -(1 + restitution) * vn * ball.mass;

        const mu = 0.5; // Adjust this value to control the surface friction
        const spinEffect = ball.angularVelocity * ball.radius * 1;
        const jt = clamp(-mu * j, mu * j, (-ball.mass * (vt - spinEffect)) * 2 / Math.PI);

        // Update velocities with velocity-dependent damping
        const dampingFactor = 1 - Math.pow(0.97, Math.abs(vn));
        ball.vx += (j * nx + jt * tx) / ball.mass * dampingFactor;
        ball.vy += (j * ny + jt * ty) / ball.mass * dampingFactor;
        ball.angularVelocity -= (jt * ball.radius) / ball.momentOfInertia * dampingFactor;

        if (nx !== 0) ball.x = nx > 0 ? ball.radius : CANVAS_WIDTH - ball.radius;
        if (ny !== 0) ball.y = ny > 0 ? ball.radius : CANVAS_HEIGHT - ball.radius;
    }
}

// Collision detection and resolution
export function checkCollision(ball1, ball2) {
    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < ball1.radius + ball2.radius) {
        // Collision detected
        const angle = Math.atan2(dy, dx);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // Rotate velocities
        const vx1 = ball1.vx * cos + ball1.vy * sin;
        const vy1 = ball1.vy * cos - ball1.vx * sin;
        const vx2 = ball2.vx * cos + ball2.vy * sin;
        const vy2 = ball2.vy * cos - ball2.vx * sin;

        // Collision reaction
        const vx1Final = ((ball1.mass - ball2.mass) * vx1 + 2 * ball2.mass * vx2) / (ball1.mass + ball2.mass);
        const vx2Final = ((ball2.mass - ball1.mass) * vx2 + 2 * ball1.mass * vx1) / (ball1.mass + ball2.mass);

        // Rotate velocities back
        ball1.vx = vx1Final * cos - vy1 * sin;
        ball1.vy = vy1 * cos + vx1Final * sin;
        ball2.vx = vx2Final * cos - vy2 * sin;
        ball2.vy = vy2 * cos + vx2Final * sin;

        // Update positions to prevent sticking
        const overlap = ball1.radius + ball2.radius - distance;
        ball1.x -= overlap / 2 * cos;
        ball1.y -= overlap / 2 * sin;
        ball2.x += overlap / 2 * cos;
        ball2.y += overlap / 2 * sin;

        // Calculate the weighted average angular velocity change
        const totalMass = ball1.mass + ball2.mass;
        const newAngularVelocity1 = (ball1.angularVelocity * ball1.mass - ball2.angularVelocity * ball2.mass) / totalMass;
        const newAngularVelocity2 = (ball2.angularVelocity * ball2.mass - ball1.angularVelocity * ball1.mass) / totalMass;

        // Apply the weighted average angular velocities
        ball1.angularVelocity = newAngularVelocity1;
        ball2.angularVelocity = newAngularVelocity2;

        // Calculate angular velocity based on collision
        const relativeVelocityX = ball2.vx - ball1.vx;
        const relativeVelocityY = ball2.vy - ball1.vy;
        const impactSpeed = Math.sqrt(relativeVelocityX * relativeVelocityX + relativeVelocityY * relativeVelocityY);
        const impactAngle = Math.atan2(relativeVelocityY, relativeVelocityX) - angle;

        // Apply angular velocity based on collision
        ball1.angularVelocity += impactSpeed * Math.sin(impactAngle) / ball1.radius;
        ball2.angularVelocity += impactSpeed * Math.sin(impactAngle) / ball2.radius;

        // Apply damping to simulate energy loss
        const dampingFactor = 0.9; // Adjust this value to control the amount of energy lost during the collision
        ball1.angularVelocity *= dampingFactor;
        ball2.angularVelocity *= dampingFactor;
    }
}