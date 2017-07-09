(function() {
    'use strict';

	var SpinzBot = function() {
		// Value initialization
		var _this = this,
			game = window.game,
			threshold = 200;
		this.me = {};
		this.deaths = 0;
		this.isRespawning = false;
		this.maxRpm = 0;

		// Settings
		this.enabled = true;

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

			var x = Math.min(Math.max(mouseX, 10), window.innerWidth - 10);
			var y = Math.min(Math.max(mouseY, 10), window.innerHeight - 10);

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
						rpm: Number(playerEntity.currentModel.rpmEntity.text._text.replace(',', '')),
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
		 * Main loop
		 */
		this.run = function() {
			$('#playerList').html('');

			var players = _this.getPlayersAround();
			var food = _this.getFoodAround();
			var desired = {
				type: 'mouseMoved',
			}

			if (players[0]) {
				var player = players[0];

				if (player.rpm > _this.me.rpm) {
					desired.x = (player.position.x * -1) + window.innerWidth;
					desired.y = (player.position.y * -1) + window.innerHeight;
				} else {
					desired.x = player.position.x;
					desired.y = player.position.y;
					desired.type = 'mouseDown';
				}
			} else {
				if (food[0]) {
					desired.x = food[0].x;
					desired.y = food[0].y;
				}
			}

			if (_this.me.rpm > _this.maxRpm) {
				_this.maxRpm = _this.me.rpm;
			}


			if (_this.me.rpm === 0) {
				_this.respawn()
			}

			if (_this.enabled) {
				_this.sendMovement(desired.x, desired.y, desired.type);
			}

			requestAnimationFrame(_this.run);
		};

		this.run();
	};

	window.bot = new SpinzBot();
})();
