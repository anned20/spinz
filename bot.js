(function() {
    'use strict';

	var SpinzBot = function() {
		// Value initialization
		var _this = this,
			game = window.game;

		this.me = {};
		this.maxRpm = 0;
		this.maxKills = 0;
		this.blocksize = 240;

		// Settings
		this.enabled = true;

		$('body').append('<div id="cursor" style="position: absolute; width: 20px; height: 20px; background-color: #FF0000;"></div>');

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
		this.sendMovement = function(mouseX, mouseY, type) {
			if (typeof type === 'undefined') {
				type = 'mouseMoved';
			}

			var x = Math.min(Math.max(mouseX, 1), window.innerWidth - 1);
			var y = Math.min(Math.max(mouseY, 1), window.innerHeight - 1);

			$('#cursor').css('left', x - 10 + 'px').css('top', y - 10 + 'px');

			if (type === 'mouseMoved') {
				game.inputManager.emit('mouseUp', {
					clientX: x,
					clientY: y,
				});
			}

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
						isSelf: game.options.nickname === playerEntity.targetTick.name,
						playerName: playerEntity.targetTick.name,
						position: {
							x: playerEntity.node.worldTransform.tx,
							y: playerEntity.node.worldTransform.ty,
						},
						absposition: {
							x: playerEntity.node.position._x,
							y: playerEntity.node.position._y,
						},
						rpm: Number(playerEntity.currentModel.rpmEntity.text._text.replace(',', '')),
						kills: Number(playerEntity.targetTick.kills),
					};

					if (toReturn.isSelf) {
						_this.me = toReturn;
					}

					return toReturn;
				})
				.filter(function(player) {
					return player.rpm > 0 && !player.isSelf;
				})
				.sortBy(function (player) {
					return player.rpm * -1;
				})
				.value();
		};

		/**
		 * Get all food around the bot sorted by reward (high to low)
		 */
		this.getFoodAround = function() {
			return _.chain(game.renderer.entities.attachments[1].attachments)
				.map(function(foodEntity) {
					return {
						x: foodEntity.node.worldTransform.tx,
						y: foodEntity.node.worldTransform.ty,
						model: foodEntity.targetTick.model ? foodEntity.targetTick.model : 'NotDot',
						reward: foodEntity.targetTick.reward,
					};
				})
				.filter(function(food) {
					return food.model === 'Dot';
				})
				.sortBy(function (food) {
					return food.reward * -1;
				})
				.value();
		}

		/**
		 * Get food clusters in blocks
		 */
		this.getFoodBlocks = function() {
			var allFood = _this.getFoodAround();
			var foodBlocks = [];

			_.each(allFood, function(food) {
				if (food.x && food.y) {
					var xBlock = Math.floor(food.x / _this.blocksize);
					var yBlock = Math.floor(food.y / _this.blocksize);

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

			return foodBlocks;
		}

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
		}

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
		this.getSimplifiedAngle = function(point1, point2) {
			var angle = _this.computeAngle(point1, point2);

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
		}

		this.ticks = 0;

		/**
		 * Main loop
		 */
		this.run = function() {
			var players = _this.getPlayersAround();

			if (_this.ticks === 0 || _this.ticks % 60 === 0) {
				_this.food = _this.getFoodBlocks();
			}

			var desired = {
				type: 'mouseMoved',
			}

			if (players[0] && players[0].rpm > 20) {
				var player = players[0];

				var distance = _this.computeDistance(player.position, _this.me.position);

				if (player.rpm < (_this.me.rpm * 0.8) && distance <= 700) {
					desired.x = player.position.x;
					desired.y = player.position.y;
				} else if (player.rpm > _this.me.rpm && distance <= 700) {
					desired.x = (player.position.x * -1) + window.innerWidth;
					desired.y = (player.position.y * -1) + window.innerHeight;
				}

				if (_this.computeDistance(player.position, _this.me.position) <= 600) {
					desired.type = 'mouseDown';
				}
				
				if (_this.me.absposition.x < 100) {
					desired.x += 100;
					console.log('border');
				}
				if (_this.me.absposition.x > (game.world.width - 100)) {
					desired.x -= 100;
					console.log('border');
				}
				if (_this.me.absposition.y < 100) {
					desired.y += 100;
					console.log('border');
				}
				if (_this.me.absposition.y > (game.world.height - 100)) {
					desired.y -= 100;
					console.log('border');
				}
			} else {
				if (_this.food[0] && _this.food[0][0]) {
					desired.x = ((_this.food[0][0].x * _this.blocksize) + (_this.blocksize / 2));
					desired.y = ((_this.food[0][0].y * _this.blocksize) + (_this.blocksize / 2));
				}
			}

			if (_this.me.rpm > _this.maxRpm) {
				_this.maxRpm = _this.me.rpm;
			}

			if (_this.me.kills > _this.maxKills) {
				_this.maxKills = _this.me.kills;
			}

			if (_this.me.rpm === 0) {
				_this.respawn()
			}

			if (_this.enabled) {
				_this.sendMovement(desired.x, desired.y, desired.type);
			}

			_this.ticks++;
			requestAnimationFrame(_this.run);
		};

		this.run();
	};

	window.bot = new SpinzBot();
})();
