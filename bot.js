(function() {
    'use strict';

	var SpinzBot = function() {
		// Value initialization
		var _this = this,
			game = window.game;

		this.players = [];
		this.food = [];
		this.me = {};
		this.maxRpm = 0;
		this.maxKills = 0;
		this.blocksize = 240;

		// Settings
		this.enabled = true;

		$('body').append('<div id="cursor" style="position: absolute; width: 20px; height: 20px; background-color: #FF0000;"></div>');
		$('body').append('<div id="infopanel" style="position: fixed; background-color: #FFF; top: 10px; left: 10px; padding: 10px;"></div>');
		$('body').prepend('<canvas id="botoverlay" style="position: fixed; width: 100%; height: 100%; top: 0px; left: 0px; display: block;"></canvas>');

		/**
		 * Function to spawn at start
		 */
		this.spawn = function() {
			$('.hud-intro-form button').click();
		};

		/**
		 * Function to respawn after death
		 */
		this.respawn = function() {
			$('.hud-respawn-actions button').click();
		};

		/**
		 * Send mouse movement
		 *
		 * @param mouseX x coordinate to send
		 * @param mouseY y coordinate to send
		 * @param type Type of event to send
		 */
		this.sendMovement = function(x, y, type) {
			$('#cursor').css('left', x - 10 + 'px').css('top', y - 10 + 'px');

			game.inputManager.emit('mouseUp', {
				clientX: x,
				clientY: y,
			});

			game.inputManager.emit(type, {
				clientX: x,
				clientY: y,
			});
		};

		/**
		 * Get all players around the bot sorted by RPM (high to low)
		 */
		this.getPlayersAround = function() {
			return _.chain(game.renderer.entities.attachments[2].attachments)
				.map(function(playerEntity) {
					var toReturn = {
						isSelf: game.world.myUid === playerEntity.targetTick.uid,
						playerName: playerEntity.targetTick.name,
						playerUid: playerEntity.targetTick.uid,
						isBoosting: playerEntity.targetTick.boosting,
						position: {
							x: playerEntity.node.worldTransform.tx,
							y: playerEntity.node.worldTransform.ty,
						},
						absposition: {
							x: playerEntity.node.position._x,
							y: playerEntity.node.position._y,
						},
						rpm: Math.floor(60 * (playerEntity.targetTick.dots / 100)),
						kills: Number(playerEntity.targetTick.kills),
					};

					if (toReturn.isSelf) {
						_this.me = toReturn;
					}

					return toReturn;
				})
				.filter(function(player) {
					var inWorld = (player.absposition.x > 0 && player.absposition.y > 0 && player.absposition.x < game.world.width && player.absposition.y < game.world.height);

					return player.rpm > 10 && !player.isSelf && inWorld;
				})
				.sortBy(function (player) {
					return player.rpm * -1;
				})
				.value();
		};

		/**
		 * Add players to desired position
		 */
		this.addPlayersToDesired = function(desired) {
			_.each(_this.players, function(player) {
				var distance = _this.computeDistance(player.position, _this.me.position);

				var angle = _this.computeAngle(player.position, _this.me.position);
				var simpleAngle = _this.getSimplifiedAngle(angle);

				var inverseAngle = angle * -1;
				var inverseSimpleAngle = simpleAngle * -1;

				var isClose = distance < 400 ? true : false;
				var multiplier = isClose ? 20 : 10;

				if (player.rpm > _this.me.rpm) {
					desired.x += ((player.position.x * -1) + window.innerWidth) * multiplier;
					desired.y += ((player.position.y * -1) + window.innerHeight) * multiplier;

					desired.total += 1 * multiplier;
				} else if (player.rpm < _this.me.rpm) {
					desired.x += player.position.x * multiplier;
					desired.y += player.position.y * multiplier;

					desired.total += 1 * multiplier;
				}

				if (isClose) {
					desired.type = 'mouseDown';
				}

				// Draw lines from me to player
				var color = (player.rpm > _this.me.rpm) ? "#FF0000" : "#00FF00";
				_this.drawLine(player.position, _this.me.position, color);
			});
		};

		/**
		 * Get all food around the bot sorted by reward (high to low)
		 */
		this.getEntitiesAround = function(model) {
			return _.chain(game.renderer.entities.attachments[1].attachments)
				.map(function(entity) {
					return {
						position: {
							x: entity.node.worldTransform.tx,
							y: entity.node.worldTransform.ty,
						},
						absposition: {
							x: entity.targetTick.position.x,
							y: entity.targetTick.position.y,
						},
						model: entity.targetTick.model,
						reward: entity.targetTick.reward,
					};
				})
				.filter(function(entity) {
					var inWorld = (entity.absposition.x > 0 && entity.absposition.y > 0 && entity.absposition.x < game.world.width && entity.absposition.y < game.world.height);

					return entity.model === model && inWorld;
				})
				.value();
		};

		/**
		 * Get all food around player
		 */
		this.getFoodAround = function() {
			return _.sortBy(_this.getEntitiesAround('Dot'), function(entity) {
				return entity.reward * -1;
			});
		};

		/**
		 * Get all whirlpools around player
		 */
		this.getWhirlPoolsAround = function() {
			return _this.getEntitiesAround('Whirlpool');
		};

		/**
		 * Get food clusters in blocks
		 */
		this.getFoodBlocks = function() {
			var allFood = _this.getFoodAround();
			var foodBlocks = [];

			_.each(allFood, function(food) {
				if (food.position.x && food.position.y) {
					var xBlock = Math.floor(food.position.x / _this.blocksize);
					var yBlock = Math.floor(food.position.y / _this.blocksize);

					if (!foodBlocks[xBlock]) {
						foodBlocks[xBlock] = [];
					}

					if (!foodBlocks[xBlock][yBlock]) {
						foodBlocks[xBlock][yBlock] = {
							value: 0,
						};
					}

					foodBlocks[xBlock][yBlock].value += food.reward;
					foodBlocks[xBlock][yBlock].x = xBlock;
					foodBlocks[xBlock][yBlock].y = yBlock;
				}
			});

			return foodBlocks;
		};

		/**
		 * Get best food block
		 */
		this.getBestFoodBlock = function() {
			var foodBlocks = _this.getFoodBlocks();

			foodBlocks = _.map(foodBlocks, function(foodBlockXs) {
				return _.sortBy(foodBlockXs, function(foodBlockY) {
					if (foodBlockY) {
						return foodBlockY.value * -1;
					}

					return 100;
				});
			});

			foodBlocks = _.sortBy(foodBlocks, function(foodBlockX) {
				if (foodBlockX && foodBlockX[0]) {
					return foodBlockX[0].value * -1;
				}

				return 100;
			});

			if (foodBlocks[0] && foodBlocks[0][0]) {
				return foodBlocks[0][0];
			}

			return false;
		};

		/**
		 * Add food to desired position
		 */
		this.addFoodToDesired = function(desired) {
			if (!_this.food) {
				return;
			}

			var multiplier = _this.food.value > 50 ? 4 : 1;

			desired.x += ((_this.food.x * _this.blocksize) + (_this.blocksize / 2)) * multiplier;
			desired.y += ((_this.food.y * _this.blocksize) + (_this.blocksize / 2)) * multiplier;
			desired.total += 1 * multiplier;
		};

		this.addWallsToDesired = function(desired) {
			var offset = 100;

			if (!_this.me.absposition) {
				return;
			}

			if (_this.me.absposition.x < offset) {
				desired.x = (window.innerWidth / 2) + offset;
			}
			if (_this.me.absposition.y < 100) {
				desired.y = (window.innerHeight / 2) + offset;
			}
			if (_this.me.absposition.x > game.world.width) {
				desired.x = (window.innerWidth / 2) - offset;
			}
			if (_this.me.absposition.y > game.world.height) {
				desired.y = (window.innerHeight / 2) - offset;
			}
		};

		/**
		 * Get distance between 2 points
		 */
		this.computeDistance = function(point1, point2) {
			var xdis = point1.x - point2.x;
			var ydis = point1.y - point2.y;

			var distance = Math.sqrt(xdis * xdis + ydis * ydis);

			return distance;
		};

		/**
		 * Get angle between 2 points
		 */
		this.computeAngle = function(point1, point2) {
			return (Math.round(Math.atan2(-(point1.y - point2.y), -(point1.x - point2.x)) / Math.PI * 180 + 180));
		};

		/**
		 * Return one of eight angles
		 *
		 * 0: left
		 * 1: above left
		 * 2: above
		 * 3: above right
		 * 4: right
		 * 5: below right
		 * 6: below
		 * 7: below left
		 */
		this.getSimplifiedAngle = function(angle) {
			if (angle >= 0 && angle < 45) {
				return 0;
			} else if (angle >= 45 && angle < 90) {
				return 1;
			} else if (angle >= 90 && angle < 135) {
				return 2;
			} else if (angle >= 135 && angle < 180) {
				return 3;
			} else if (angle >= 180 && angle < 225) {
				return 4;
			} else if (angle >= 225 && angle < 270) {
				return 5;
			} else if (angle >= 270 && angle < 315) {
				return 6;
			} else if (angle >= 315 && angle < 360) {
				return 7;
			}
		};

		/**
		 * Get x and y from a angle
		 *
		 */
		this.simpleAngleToXY = function(angle) {
			switch (angle) {
				case 0:
					return {x: -300, y: 0};
					break;
				
				case 1:
					return {x: -300, y: -300};
					break;
				
				case 2:
					return {x: 0, y: -300};
					break;
				
				case 3:
					return {x: 300, y: -300};
					break;
				
				case 4:
					return {x: 300, y: 0};
					break;
				
				case 5:
					return {x: 300, y: 300};
					break;
				
				case 6:
					return {x: 0, y: 300};
					break;
				
				case 7:
					return {x: -300, y: 300};
					break;
				
				default:
					return {x: 0, y: 0};
					break;
			}
		}

		/**
		 * Draw line on botoverlay from pos1 to pos2 with color
		 */
		this.drawLine = function(pos1, pos2, color) {
			var c = document.getElementById("botoverlay");
			var ctx = c.getContext("2d");

			if (pos1 && pos2) {
				ctx.beginPath();

				ctx.strokeStyle = color;

				ctx.moveTo(pos1.x, pos1.y);
				ctx.lineTo(pos2.x, pos2.y);

				ctx.stroke();
			}
		};

		/**
		 * Clear botoverlay
		 */
		this.clearCanvas = function() {
			var c = document.getElementById("botoverlay");
			var ctx = c.getContext("2d");

			ctx.clearRect(0, 0, c.width, c.height);
		};

		this.ticks = 0;
		/**
		 * Main loop
		 */
		this.run = function() {
			_this.clearCanvas();

			var desired = {
				type: 'mouseMoved',
				x: 0,
				y: 0,
				total: 0,
			};

			_this.players = _this.getPlayersAround();
			if (_this.ticks === 0 || _this.ticks % 60 === 0) {
				_this.food = _this.getBestFoodBlock();
			}

			var playerList = _.reduce(_this.players, function(mem, player) { return mem + '<b>' + player.playerName + '</b> (' + player.rpm + ')<br>'; }, '');
			$('#infopanel').html(playerList);

			// if (players && players.length > 0) {
				// _.each(players, function(player) {
				// });
			// }

			_this.addPlayersToDesired(desired);
			_this.addFoodToDesired(desired);
			_this.addWallsToDesired(desired);

			if (_this.me.rpm > _this.maxRpm) {
				_this.maxRpm = _this.me.rpm;
			}

			if (_this.me.kills > _this.maxKills) {
				_this.maxKills = _this.me.kills;
			}

			if (_this.me.rpm === 0) {
				_this.respawn();
			}

			if (_this.enabled) {
				console.log(desired);
				_this.sendMovement(desired.x / desired.total, desired.y / desired.total, desired.type);
			}

			_this.ticks++;
			requestAnimationFrame(_this.run);
		};

		this.run();
	};

	window.bot = new SpinzBot();

	// Toggle bot active
	window.addEventListener('keydown', function(e) {
		if (e.which === 32) {
			window.bot.enabled = !window.bot.enabled;
		}
	}, true);

	// Canvas resizing
	var canvas = document.getElementById('botoverlay');
	window.addEventListener('resize', resizeCanvas, false);
	function resizeCanvas() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
	resizeCanvas();
})();
