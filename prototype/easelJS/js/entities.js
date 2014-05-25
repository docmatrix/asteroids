/************************************/
/** ------ Entity Interface ------ **/
/************************************/
var Entity = (function() {

	function Entity() {};

	// Used to normalise all entity collisions and updates in game
	return {
		constructor : Entity,
		/* Generic */
		className : function() { 
		   var funcNameRegex = /function (.{1,})\(/;
		   var results = (funcNameRegex).exec((this).constructor.toString());
		   return (results && results.length > 1) ? results[1] : "";
		},

		/* GFX and state */
		update : function(){},
		render : function(){},
		setShape : function(){},
		isDead : function(){ return false; },

		/* Physics */
		getDimensions : function() { 
			return { 
				x : this.shape.getBounds().x,
				y : this.shape.getBounds().y,
				width : this.shape.getBounds().width,
				height : this.shape.getBounds().height,
				points : this.points || null,
				rotation : this.rotation || 0
			} 
		},
		getHitBox : function(){},
		getHitBoxType : function(){},
		canCollideWidth : function(entity){ return false },
		explode : function() {}
	}
})();

/**************************************/
/** ------ Entity definitions ------ **/
/**************************************/
var Asteroid = (function(Entity) {

	// Static fields
	var SPEED = 0//(0.025 * window.devicePixelRatio); // Pixels per ms (asteroids have constant speed)
	var SIZES = { // Mapping of "size type" to radius of asteroids
		0 : 10,
		1 : 20,
		2 : 40,
		3 : 60,
		4 : 80
	};
	var ROTATION_SPEED = 0.014; // in degrees per ms
	var EXPLOSION_CHILDREN = 1; // Number of children that are created when asteroid explodes

	function Asteroid(sizeIndex) {
		// Mixin entity base class
		for(var method in Entity) {
			if(this[method] == undefined) {
				this[method] = Entity[method];
			}
		}
		// Set sizeIndex
		sizeIndex = (sizeIndex == null)? 1 : sizeIndex;
		this.sizeIndex = sizeIndex;

		// Initialise Asteroid
		this.init();
	}

	Asteroid.prototype = {
		constructor : Asteroid,
		init : function() {
			// Velocity components (between 1 and -1)
			this.vx = ((Math.random()) * 2) - 1;
			this.vy = ((Math.random()) * 2) - 1;

			// Normalise
			this.vx = 1 / (Math.abs(this.vx) + Math.abs(this.vy)) * this.vx;
			this.vy = 1 / (Math.abs(this.vx) + Math.abs(this.vy)) * this.vy;

			// Speed
			this.speed = SPEED * (Math.random() + 0.5);

			// FPS independent movement
			this.lastUpdate = new Date().getTime();

			// Current size index
			this.radius = SIZES[this.sizeIndex];

			// Max extents
			this.maxX = window.spaceRocks.getDimensions().width;
			this.maxY = window.spaceRocks.getDimensions().height;

			// Rotation speed and angle (in degress per ms)
			this.rotation = 0;
			this.rotationSpeed = ROTATION_SPEED * (Math.random() + 0.5);
			if(Math.floor(Math.random() * 100) % 2 === 0) {
				this.rotationSpeed = 0 - this.rotationSpeed;
			}

			// Dies when goes below lowest size
			this.exploded = false;
		},
		getRandomInRange : function(min, max) {
			return Math.random() * (max - min) + min;
		},
		drawOutline : function(shape) {
			var asteroidRadius = this.radius;

			// Furthest indentation can be from outer edge of circle
			this.minRadius = asteroidRadius * 0.7;
			this.maxRadius = asteroidRadius * 1;

			// Shortest and longest lengths for lines between edges of asteroid
			var minLineDistance = (2 * Math.PI) / 20;
			var maxLineDistance = (2 * Math.PI) / 15;

			// First point is at 0 rad
			this.points = new Array();
			var distanceFromCenter = this.getRandomInRange(this.minRadius, this.maxRadius);
			var firstPoint = new createjs.Point(distanceFromCenter, 0);
			var currentPoint = firstPoint;
			var angle = 0.0;
			var vx = 1;
			var vy = 0;
			shape.graphics.setStrokeStyle(4).beginStroke("#ffffff");
			shape.graphics.moveTo(firstPoint.x, firstPoint.y);
			this.points.push(firstPoint);
			while(angle < ((2 * Math.PI) - maxLineDistance)) {
				var lineLength = this.getRandomInRange(minLineDistance, maxLineDistance);
				angle += this.getRandomInRange(minLineDistance, maxLineDistance);
				distanceFromCenter = this.getRandomInRange(this.minRadius, this.maxRadius);
				vx = Math.cos(angle);
				vy = Math.sin(angle);
				nextPoint = new createjs.Point(vx * distanceFromCenter, vy * distanceFromCenter);
				this.points.push(nextPoint);
				shape.graphics.arcTo(currentPoint.x, currentPoint.y,  nextPoint.x,  nextPoint.y,  asteroidRadius / 6);
				currentPoint = nextPoint;
			}

			// Draw final line (@TODO look into curveTo)
			shape.graphics.arcTo(firstPoint.x, currentPoint.y, firstPoint.x, firstPoint.y, 5);
			shape.graphics.lineTo(firstPoint.x, firstPoint.y);
			shape.graphics.endStroke();
		},
		setShape : function(shape) {
			this.shape = shape;
			this.shape.scaleX = window.devicePixelRatio;
			this.shape.scaleY = window.devicePixelRatio;
			this.drawOutline(this.shape);
			this.shape.cache(-(this.radius + 4), 
							-(this.radius + 4), 
							(this.radius * 2) + 8, 
							(this.radius * 2) + 8, 
							window.devicePixelRatio);
			this.shape.snapToPixel = true;

			// To calculate initial bounding box
			this.render();
		},
		canCollideWidth : function(entity) {
			var collidesWith = new Array("Missile", "MissileExplosion", "Player");
			return collidesWith.indexOf(entity.className()) !== -1;
		},
		getHitBoxType : function() {
			return Physics.hitBoxTypes.CIRCLE;
		},
		explode : function() {
			// Create two new asteroids if sizeIndex is greater than 0
			if(this.sizeIndex > 0) {
				for(var i = 0; i < EXPLOSION_CHILDREN; i++) {
					var asteroid = new Asteroid((this.sizeIndex - 1));
					
					// Set start location
					asteroid.x = this.x;
					asteroid.y = this.y;
					asteroid.speed = this.speed * 1.4;
					asteroid.setShape(new createjs.Shape());

					// Add to entity list
					window.spaceRocks.addEntity(asteroid);
				}
			}

			this.exploded = true;
		},
		render : function() {
			// @TODO render parts on opposite sceen when rendering goes offscreen
			this.shape.x = this.x;
			this.shape.y = this.y;
			this.shape.rotation = this.rotation;

			// Set bounds just below maximum extent
			var radiusDiff = this.maxRadius - this.minRadius;
			var diameter = (this.minRadius + (0.7 * radiusDiff)) * 2;
			this.shape.setBounds(this.x, this.y, diameter * this.shape.scaleX, diameter * this.shape.scaleY);
		},
		update : function() {
			var timeSinceUpdate = new Date().getTime() - this.lastUpdate;
			this.lastUpdate = new Date().getTime();

			this.x += (timeSinceUpdate * this.speed) * this.vx;
			this.y += (timeSinceUpdate * this.speed) * this.vy;

			// Clamp location (origin is in top left of shape)
			this.x = (this.x - (this.radius * window.devicePixelRatio) > this.maxX)? (0 - this.radius * window.devicePixelRatio) : this.x;
			this.x = (this.x + (this.radius * window.devicePixelRatio) < 0)? (this.maxX + this.radius * window.devicePixelRatio) : this.x;
			this.y = (this.y - (this.radius * window.devicePixelRatio) > this.maxY)? (0 - this.radius * window.devicePixelRatio) : this.y;
			this.y = (this.y + (this.radius * window.devicePixelRatio) < 0)? (this.maxY + this.radius * window.devicePixelRatio) : this.y;

			// Rotate asteroid
			this.rotation += (timeSinceUpdate * this.rotationSpeed);
			if(this.rotation > 0) {
				this.rotation = 0 + (Math.abs(this.rotation) % 360);
			} else {
				this.rotation = 0 - (Math.abs(this.rotation) % 360);
			}
		},
		isDead : function() {
			return this.exploded;
		}
	}

	return Asteroid;
})(Entity);

var MissileExplosion =  (function(Entity) {
	var EXPLOSION_TIME = 1500; // Explosion length in ms
	var EXPLOSION_RADIUS = 30; // Explosion radius in pixels

	function MissileExplosion() {
		// Mixin entity base class
		for(var method in Entity) {
			if(this[method] == undefined) {
				this[method] = Entity[method];
			}
		}

		// Explosion start time
		this.explositionStart = new Date().getTime();
		this.radius = 1;

		// So that animation can be time related
		this.lastUpdate = new Date().getTime();
	}

	MissileExplosion.prototype = {
		constructor : MissileExplosion,
		setShape : function(shape) {
			this.shape = shape;
			this.shape.scaleX = window.devicePixelRatio;
			this.shape.scaleY = window.devicePixelRatio;
			this.shape.snapToPixel = true;
			this.render();
		},
		getHitBoxType : function() {
			return Physics.hitBoxTypes.CIRCLE
		},
		canCollideWidth : function(entity) {
			var collidesWith = new Array("Asteroid", "Alien", "Lazer");
			return collidesWith.indexOf(entity.className()) !== -1;
		},
		render : function() {
			this.shape.x = this.x;
			this.shape.y = this.y;
			this.shape.graphics.clear().beginFill("#eee").drawCircle(0, 0, this.radius, this.radius);

			var diameter = this.radius * 2;
			this.shape.setBounds(this.x - this.radius, this.y - this.radius, diameter * this.shape.scaleX, diameter * this.shape.scaleY);
		},
		update : function() {
			// Expand or contract size based on time since explosion
			this.timeSinceExplosion = new Date().getTime() - this.explositionStart;
			this.timeSinceLastUpdate = new Date().getTime() - this.lastUpdate;
			this.lastUpdate = new Date().getTime();

			// If it's passed halfway start contracting
			var pixelsPerMS = EXPLOSION_RADIUS / EXPLOSION_TIME;
			if(this.timeSinceExplosion > EXPLOSION_TIME / 2) {
				this.radius -= pixelsPerMS * this.timeSinceLastUpdate;
			} else {
				this.radius += pixelsPerMS * this.timeSinceLastUpdate;
			}
		},
		isDead : function() {
			return this.radius < 0;
		}
	}

	return MissileExplosion;
})(Entity);

var Missile = (function(Entity) {
	//var this;

	var ACCELERATION = (0.00002 * window.devicePixelRatio); // Pixels per ms to add for each pixel distance from heading
	var MAX_SPEED = (0.45 * window.devicePixelRatio); // Pixels per ms
	var MIN_SPEED = (0.2 * window.devicePixelRatio); // Pixels per ms
	var TURN_SPEED = 0.0006; // Speed of turn in MS. 1 = turn to face in 1ms 

	// Temporary before sprite is used
	var SIZE = 3;

	function Missile() {
		// Mixin entity base class
		for(var method in Entity) {
			if(this[method] == undefined) {
				this[method] = Entity[method];
			}
		}

		// Velocity components (between 0 and -1)
		this.vx = 0;
		this.vy = 0;

		// Location that missile is heading toward
		this.xHeading = null;
		this.yHeading = null;

		// Speed
		this.speed = 0;

		// FPS independent movement
		this.lastUpdate = new Date().getTime();
	}

	Missile.prototype = {
		constructor : Missile,
		setShape : function(shape) {
			this.shape = shape;
			this.shape.graphics.beginFill("#ccc").drawCircle(0, 0, SIZE, SIZE);
			this.shape.regX = SIZE / 2;
			this.shape.regY = SIZE / 2;
			this.shape.scaleX = window.devicePixelRatio;
			this.shape.scaleY = window.devicePixelRatio;
			this.shape.cache(-SIZE, -SIZE, SIZE * 2, SIZE * 2, window.devicePixelRatio);
			this.shape.snapToPixel = true;
			this.shape.setBounds(this.x, this.y, 1, 1);
		},
		setHeading : function(xHeading, yHeading) {
			this.xHeading = xHeading;
			this.yHeading = yHeading;
		},
		getHitBoxType : function() {
			return Physics.hitBoxTypes.POINT
		},
		canCollideWidth : function(entity) {
			var collidesWith = new Array("Asteroid", "Alien", "Lazer");
			return collidesWith.indexOf(entity.className()) !== -1;
		},
		render : function() {
			this.shape.x = this.x;
			this.shape.y = this.y;
			this.shape.setBounds(this.x, this.y, SIZE * this.shape.regX, SIZE * this.shape.regY);
		},
		update : function() {
			if(this.exploded) return;

			var timeSinceUpdate = new Date().getTime() - this.lastUpdate;
			this.lastUpdate = new Date().getTime();

			// Get vector which connects current location to target
			var xDiff = this.xHeading - this.x;
			var yDiff = this.yHeading - this.y;
			var hvx = (1 / (Math.abs(xDiff) + Math.abs(yDiff))) *  xDiff;
			var hvy = (1 / (Math.abs(xDiff) + Math.abs(yDiff))) *  yDiff;

			// Move heading towards target
			if(this.vx !== hvx) {
				var direction = (this.vx > hvx)? -1 : 1;
				this.vx += (timeSinceUpdate * TURN_SPEED) * direction;
			}
			if(this.vy !== hvy) {
				var direction = (this.vy > hvy)? -1 : 1;
				this.vy += (timeSinceUpdate * TURN_SPEED) * direction;
			}

			// Update speed
			this.speed += ACCELERATION * timeSinceUpdate;
			this.speed = (this.speed < MIN_SPEED)? MIN_SPEED : this.speed;
			this.speed = (this.speed > MAX_SPEED)? MAX_SPEED : this.speed;

			// Update location
			this.x += (timeSinceUpdate * this.speed) * this.vx;
			this.y += (timeSinceUpdate * this.speed) * this.vy;

			// If dead add an explosion
			if(this.isDead()) {
				this.explode();
			}
		},
		explode : function() {
			// Setup shape and missle
			var shape = new createjs.Shape();
			var missileExplosion = new MissileExplosion();
			missileExplosion.setShape(shape);
			missileExplosion.x = this.x;
			missileExplosion.y = this.y;
			window.spaceRocks.addEntity(missileExplosion, 1);

			this.exploded = true;
		},
		isDead : function() {
			return this.exploded || (Math.abs(this.x - this.xHeading) + Math.abs(this.y - this.yHeading) < 10);
		}
	}

	return Missile;
})(Entity);

var Player = (function(Entity) {
	/*  Static vars */
	// Dimensions
	var WIDTH = 20;
	var HEIGHT = 30;

	// Speed fields
	var ACCELERATION = (0.00000150 * window.devicePixelRatio); // Pixels per ms to add for each pixel distance from heading
	var MAX_SPEED = (0.15 * window.devicePixelRatio); // Pixels per ms
	var TURN_SPEED = 0.0003; // Speed of turn in MS. 1 = turn to face in 1ms

	// Data fields
	var MAX_MISSILES = 5;
	var MISSILE_RECHARGE_TIME = 500; // in ms
	var MISSILE_INITIAL_SPEED = 1.4; // Mltiplier for missile exit speed
	var INVULNERABLE_TIME = 2000; // ms that player is invulnerable after being killed

	function Player() {
		// Mixin entity base class
		for(var method in Entity) {
			if(this[method] == undefined) {
				this[method] = Entity[method];
			}
		}
		// Scale based on canvas size
		ACCELERATION *= window.spaceRocks.getDimensions().width / (320 * window.devicePixelRatio);
		MAX_SPEED *= window.spaceRocks.getDimensions().width / (320 * window.devicePixelRatio);

		this.init();
	} 

	Player.prototype = {
		constructor : Player,
		init : function() {
			/**************************/
			/* START: movement fields */
			/**************************/
			// Location
			this.x = (window.spaceRocks.width / 2) - (WIDTH / 2);
			this.y = (window.spaceRocks.height / 2) - (HEIGHT / 2);

			// Dimensions
			this.width = WIDTH;
			this.height = HEIGHT;

			// Rotation
			this.rotation = 0.0;

			// Velocity components (between 0 and -1)
			this.vx = 0;
			this.vy = 0;

			// Location that ship is heading toward
			this.xHeading = null;
			this.yHeading = null;

			// Speed
			this.speed = 0;

			// Last update (so updates can be FPS independent)
			this.lastUpdate = new Date().getTime();

			// Max locations for ship
			this.maxX =  window.spaceRocks.getDimensions().width;
			this.maxY = window.spaceRocks.getDimensions().height;
			/************************/
			/* END: movement fields */
			/************************/

			/**********************/
			/* START: data fields */
			/**********************/
			this.missileFired = null; // So that missiles can be fired in update loop
			this.activeMissiles = new Array();
			this.missileCount = 5;
			this.lastMissileFired = new Date().getTime();
			this.lastMissileRecharged = new Date().getTime();
			this.lifeCount = 300;
			this.invulerable = false;
			this.invulerableStartTime = null;
			/********************/
			/* END: data fields */
			/********************/
		},
		/* Setter function so caching can be setup immediately */
		setShape : function(shape) {
			this.shape = shape;
			this.shape.graphics.beginFill("#ff0000").drawRect(0, 0, WIDTH, HEIGHT);
			this.shape.scaleX = window.devicePixelRatio;
			this.shape.scaleY = window.devicePixelRatio;
			this.shape.regX = WIDTH / 2;
			this.shape.regY = HEIGHT / 2;
			this.shape.cache(-WIDTH, -HEIGHT, WIDTH * 2, HEIGHT * 2, window.devicePixelRatio);
			this.shape.snapToPixel = true;
		},
		setHeading : function(x, y) {
			this.xHeading = x;
			this.yHeading = y;
		},
		fireMissile : function(x, y) {
			this.missileFired = new createjs.Point(x, y); // Will actually be fired in next update loop
		},
		getHitBoxType : function() {
			return Physics.hitBoxTypes.RECTANGLE
		},
		canCollideWidth : function(entity) {
			var collidesWith = new Array("Asteroid", "Alien", "Lazer");
			//console.log("player collides with " + entity.className() + "?");
			return collidesWith.indexOf(entity.className()) !== -1;
		},
		explode : function() {
			if(this.invulerable) return;

			if(--this.lifeCount !== 0) {
				var savedLifeCount = this.lifeCount;
				this.shape.graphics.beginFill("#ccc").drawRect(0, 0, WIDTH, HEIGHT);
				this.shape.updateCache();
				this.init();
				this.lifeCount = savedLifeCount;
				this.invulerableStartTime = new Date().getTime();
				this.invulerable = true;
			}
		},
		render : function() {
			this.shape.x = this.x;
			this.shape.y = this.y;
			this.shape.rotation = this.rotation;

			// Additional calculations since player origin is in center of object for rotation purposes
			this.shape.setBounds(this.x - ((WIDTH * this.shape.scaleX) / 2), this.y - ((HEIGHT * this.shape.scaleY) / 2), WIDTH * this.shape.scaleX, HEIGHT * this.shape.scaleY);
		},
		update : function() {
			var timeSinceUpdate = new Date().getTime() - this.lastUpdate;
			this.lastUpdate = new Date().getTime();

			// Invilerability toggle
			if(this.invulerable && new Date().getTime() - this.invulerableStartTime > INVULNERABLE_TIME) {
				this.invulerable = false;
				this.shape.graphics.beginFill("#ff0000").drawRect(0, 0, WIDTH, HEIGHT);
				this.shape.updateCache();
			}

			// If target heading is not null adjust current heading and speed
			if(this.xHeading !== null && this.yHeading !== null) {
				// Calculate hvx and hvy from current location
				var xDiff = this.xHeading - this.x;
				var yDiff = this.yHeading - this.y;
				var hvx = (1 / (Math.abs(xDiff) + Math.abs(yDiff))) *  xDiff;
				var hvy = (1 / (Math.abs(xDiff) + Math.abs(yDiff))) *  yDiff;

				// Move heading towards target
				if(this.vx !== hvx) {
					var direction = (this.vx > hvx)? -1 : 1;
					this.vx += (timeSinceUpdate * TURN_SPEED) * direction;
				}
				if(this.vy !== hvy) {
					var direction = (this.vy > hvy)? -1 : 1;
					this.vy += (timeSinceUpdate * TURN_SPEED) * direction;
				}

				// Set speed based on length of line (no need to be preceise with sqrt)
				var distanceToHeading = (xDiff + yDiff) / 2;
				this.speed += (timeSinceUpdate * ACCELERATION) * Math.abs(distanceToHeading);
				this.speed = (this.speed > MAX_SPEED)? 0 + MAX_SPEED : this.speed;
			}

			// Update location
			this.x += (timeSinceUpdate * this.speed) * this.vx;
			this.y += (timeSinceUpdate * this.speed) * this.vy;

			// Clamp location (origin is in center of shape)
			this.x = ((this.x - this.width / 2) > this.maxX)? (0 - this.width / 2) : this.x;
			this.x = ((this.x + this.width / 2) < 0)? (this.maxX + this.width / 2) : this.x;
			this.y = ((this.y - this.height / 2) > this.maxY)? (0 - this.height / 2) : this.y;
			this.y = ((this.y + this.height / 2) < 0)? (this.maxY + this.height / 2) : this.y;

			// Turn to face current heading
			if(this.vy !== 0 && this.vx !== 0) {
				this.rotation = Math.atan2(this.vy, this.vx) * (180 / Math.PI) + 90;
			}

			// Recharge missiles
			if(new Date().getTime() - this.lastMissileFired > MISSILE_RECHARGE_TIME 
				&& new Date().getTime() - this.lastMissileRecharged > MISSILE_RECHARGE_TIME 
				&& this.missileCount < MAX_MISSILES) {
				this.lastMissileRecharged = new Date().getTime();
				++this.missileCount;
			}

			// Create missiles
			if(this.missileCount > 0 && this.missileFired) {
				// Adjust missile count for player
				--this.missileCount;
				this.lastMissileFired = new Date().getTime();

				// Setup shape and missle
				var shape = new createjs.Shape();
				var missile = new Missile();
				missile.setHeading(this.missileFired.x, this.missileFired.y);
				missile.vx = this.vx;
				missile.vy = this.vy;
				missile.x = this.x + (this.vx * (this.width / 2));	// TODO: Poisiton missile at middle top of ship
				missile.y = this.y + (this.vy * (this.height / 2));	// TODO: Poisiton missile at middle top of ship
				missile.speed = this.speed * MISSILE_INITIAL_SPEED;
				missile.setShape(shape);
				window.spaceRocks.addEntity(missile, 1);
				this.missileFired = false;
			}
		}
	}

	return Player;
})(Entity);

var Lazer = (function(Entity) {
	var SPEED = (0.1 * window.devicePixelRatio); // Pixels per ms
	var SIZE = 2;

	function Lazer() {
		// Mixin entity base class
		for(var method in Entity) {
			if(this[method] == undefined) {
				this[method] = Entity[method];
			}
		}

		// Velocity components (between 0 and -1)
		this.vx = 0;
		this.vy = 0;

		// Location that missile is heading toward
		this.xHeading = null;
		this.yHeading = null;

		// Speed
		this.speed = SPEED;

		// FPS independent movement
		this.lastUpdate = new Date().getTime();
	}

	Lazer.prototype = {
		constructor : Lazer,
		setShape : function(shape) {
			this.shape = shape;
			this.shape.graphics.beginFill("#00cc00").drawCircle(0, 0, SIZE, SIZE);
			this.shape.regX = SIZE / 2;
			this.shape.regY = SIZE / 2;
			this.shape.scaleX = window.devicePixelRatio;
			this.shape.scaleY = window.devicePixelRatio;
			this.shape.cache(-SIZE, -SIZE, SIZE * 2, SIZE * 2, window.devicePixelRatio);
			this.shape.snapToPixel = true;
			this.shape.setBounds(this.x, this.y, 1, 1);
		},
		setHeading : function(xHeading, yHeading) {
			this.xHeading = xHeading;
			this.yHeading = yHeading;
		},
		getHitBoxType : function() {
			return Physics.hitBoxTypes.POINT
		},
		canCollideWidth : function(entity) {
			var collidesWith = new Array("Player", "Missile", "MissileExplosion");
			return collidesWith.indexOf(entity.className()) !== -1;
		},
		render : function() {
			this.shape.x = this.x;
			this.shape.y = this.y;
			this.shape.setBounds(this.x, this.y, SIZE * this.shape.regX, SIZE * this.shape.regY);
		},
		update : function() {
			if(this.exploded) return;

			var timeSinceUpdate = new Date().getTime() - this.lastUpdate;
			this.lastUpdate = new Date().getTime();

			// Get vector which connects current location to target
			var xDiff = this.xHeading - this.x;
			var yDiff = this.yHeading - this.y;
			this.vx = (1 / (Math.abs(xDiff) + Math.abs(yDiff))) *  xDiff;
			this.vy = (1 / (Math.abs(xDiff) + Math.abs(yDiff))) *  yDiff;

			// Update location
			this.x += (timeSinceUpdate * this.speed) * this.vx;
			this.y += (timeSinceUpdate * this.speed) * this.vy;

			// If dead add an explosion
			if(this.isDead()) {
				this.explode();
			}
		},
		explode : function() {
			this.exploded = true;
		},
		isDead : function() {
			return this.exploded || (Math.abs(this.x - this.xHeading) + Math.abs(this.y - this.yHeading) < 5);
		}
	}

	return Lazer;
})(Entity);

var Alien = (function(Entity) {
	// Constant speed
	var SPEED = (0.05 * window.devicePixelRatio); // Pixels per ms

	// Time at which interval could change, and percentage to change
	var HEADING_CHANGE_INTERVAL = 5000;
	var HEADING_CHANGE_CHANCE = 0.5;

	// Firing intervals
	var FIRE_INTERVAL = 1000;
	var FIRE_CHANCE = 0.5;

	// Temporary before sprite is used
	var SIZE = 15;

	function Alien() {
		// Mixin entity base class
		for(var method in Entity) {
			if(this[method] == undefined) {
				this[method] = Entity[method];
			}
		}
		// Max extents
		this.maxX = window.spaceRocks.getDimensions().width;
		this.maxY = window.spaceRocks.getDimensions().height;

		// Velocity components (between 0 and -1)
		this.vx = 0;
		this.vy = 0;

		// Location that missile is heading toward
		this.xHeading = null;
		this.yHeading = null;

		// Speed
		this.speed = SPEED;

		// FPS independent movement
		this.lastUpdate = new Date().getTime();
		this.updateHeading();
		this.lastLazer = new Date().getTime();
	}

	Alien.prototype = {
		constructor : Alien,
		setShape : function(shape) {
			this.shape = shape;
			this.shape.graphics.beginFill("#00ff00").drawCircle(0, 0, SIZE, SIZE);
			this.shape.regX = SIZE / 2;
			this.shape.regY = SIZE / 2;
			this.shape.scaleX = window.devicePixelRatio;
			this.shape.scaleY = window.devicePixelRatio;
			this.shape.cache(-SIZE, -SIZE, SIZE * 2, SIZE * 2, window.devicePixelRatio);
			this.shape.snapToPixel = true;
			this.shape.setBounds(this.x, this.y, SIZE * this.shape.scaleX, SIZE * this.shape.scaleX);
		},
		updateHeading : function() {
			this.setHeading(this.maxX * Math.random(), this.maxY * Math.random());
			this.lastHeadingUpdate = new Date().getTime();
		},
		setHeading : function(xHeading, yHeading) {
			this.xHeading = xHeading;
			this.yHeading = yHeading;
		},
		getHitBoxType : function() {
			return Physics.hitBoxTypes.CIRCLE;
		},
		canCollideWidth : function(entity) {
			var collidesWith = new Array("Player", "Missile", "MissileExplosion");
			return collidesWith.indexOf(entity.className()) !== -1;
		},
		render : function() {
			this.shape.x = this.x;
			this.shape.y = this.y;

			var diameter = SIZE * 2;
			this.shape.setBounds(this.x - SIZE, this.y - SIZE, diameter * this.shape.scaleX, diameter * this.shape.scaleY);
		},
		update : function() {
			if(this.exploded) return;

			var timeSinceUpdate = new Date().getTime() - this.lastUpdate;
			var timeSinceHeadingUpdate = new Date().getTime() - this.lastHeadingUpdate;
			this.lastUpdate = new Date().getTime();

			// Possibly change heading
			if(timeSinceHeadingUpdate > HEADING_CHANGE_INTERVAL) {
				if(Math.random() > HEADING_CHANGE_CHANCE) {
					this.updateHeading();
				}
				this.lastHeadingUpdate = new Date().getTime();
			}

			// Possibly shoot lazer
			this.shootLazer();

			// Get vector which connects current location to target
			var xDiff = this.xHeading - this.x;
			var yDiff = this.yHeading - this.y;
			this.vx = (1 / (Math.abs(xDiff) + Math.abs(yDiff))) *  xDiff;
			this.vy = (1 / (Math.abs(xDiff) + Math.abs(yDiff))) *  yDiff;

			// Clamp heading if we're 'close enough'
			if(Math.abs(this.x - this.xHeading) + Math.abs(this.y - this.yHeading) < 10) {
				this.vx = 0;
				this.vy = 0;
			}

			// Move alien
			this.x += (timeSinceUpdate * this.speed) * this.vx;
			this.y += (timeSinceUpdate * this.speed) * this.vy;

			// Clamp location (origin is in top left of shape)
			this.x = (this.x - (this.radius * window.devicePixelRatio) > this.maxX)? (0 - this.radius * window.devicePixelRatio) : this.x;
			this.x = (this.x + (this.radius * window.devicePixelRatio) < 0)? (this.maxX + this.radius * window.devicePixelRatio) : this.x;
			this.y = (this.y - (this.radius * window.devicePixelRatio) > this.maxY)? (0 - this.radius * window.devicePixelRatio) : this.y;
			this.y = (this.y + (this.radius * window.devicePixelRatio) < 0)? (this.maxY + this.radius * window.devicePixelRatio) : this.y;

			// If dead add an explosion
			if(this.isDead()) {
				this.explode();
			}
		},
		shootLazer : function() {
			var timeSinceLazer = new Date().getTime() - this.lastLazer;
			if(timeSinceLazer > FIRE_INTERVAL) {
				if(Math.random() > FIRE_CHANCE) {
					var shape = new createjs.Shape();
					var lazer = new Lazer();
					var playerLocation = window.spaceRocks.getPlayerLocaton()

					lazer.setHeading(playerLocation.x, playerLocation.y);
					lazer.x = this.x;
					lazer.y = this.y;
					lazer.setShape(shape);
					window.spaceRocks.addEntity(lazer, 1);
				}

				this.lastLazer = new Date().getTime();
			}
		},
		explode : function() {
			// @TODO Some animations here...
			this.exploded = true;
		},
		isDead : function() {
			return this.exploded;
		}
	}

	return Alien;
})(Entity);