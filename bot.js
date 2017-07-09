(function() {
    'use strict';

	var SpinzBot = function() {
		var _this = this;
		var game = window.game;
		var me = {};
		var threshold = 100;

		this.mode = 'defensive'; // Aggresive to follow everyone, defensive to flee for everyone
		this.disabled = false;

		$('body').append('<div style="position: absolute; background-color: #FFFFFF; top: 10px; left: 10px; padding: 10px;" id="playerList"></div>');

		this.spawn = function() {
			console.log('Spawning');
			var playButton = $('.hud-intro-form button');
			playButton.click();
		};

		this.respawn = function() {
			console.log('Respawning');
			var respawnButton = $('.hud-respawn-actions button');
			respawnButton.click();
		};

		this.sendMovement = function(mouseX, mouseY, type) {
			if (typeof type === 'undefined') {
				type = 'mouseMoved';
			}

			var x = Math.min(Math.max(mouseX, 10), window.innerWidth - 10);
			var y = Math.min(Math.max(mouseY, 10), window.innerHeight - 10);

			// console.log(x, y, type);

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

		this.goDirection = function(direction) {
			switch (direction) {
				case 'left':
					this.sendMovement(0, window.innerHeight / 2);
					break;
				
				case 'right':
					this.sendMovement(window.innerWidth, window.innerHeight / 2);
					break;
				
				case 'up':
					this.sendMovement(window.innerWidth / 2, 0);
					break;
				
				case 'down':
					this.sendMovement(window.innerWidth / 2, window.innerHeight);
					break;

				case 'leftup':
					this.sendMovement((window.innerWidth / 2) - 100, (window.innerHeight / 2) - 100);
					break;
				
				case 'leftdown':
					this.sendMovement((window.innerWidth / 2) - 100, (window.innerHeight / 2) + 100);
					break;
				
				case 'rightup':
					this.sendMovement((window.innerWidth / 2) + 100, (window.innerHeight / 2) - 100);
					break;
				
				case 'rightdown':
					this.sendMovement((window.innerWidth / 2) + 100, (window.innerHeight / 2) + 100);
					break;
				
				default:
					this.sendMovement(window.innerWidth / 2, window.innerHeight / 2);
					break;
			}
		};

		this.getAmount = function(type) {
			var types = {
				'food': 1,
				'players': 2,
			}

			return game.renderer.entities.attachments[types[type]].attachments.length;
		}

		this.getPlayersAround = function() {
			return _.filter(_.map(game.renderer.entities.attachments[2].attachments, function(playerEntity, index) {
				var toReturn = {
					isSelf: game.options.nickname === playerEntity.targetTick.name,
					playerName: playerEntity.targetTick.name,
					position: {
						x: playerEntity.currentModel.node.worldTransform.tx,
						y: playerEntity.currentModel.node.worldTransform.ty,
					},
					rpm: Number(playerEntity.currentModel.rpmEntity.text._text.replace(',', '')),
				};

				if (toReturn.isSelf) {
					me = toReturn;
				}

				return toReturn;
			}), function(player) {
				return player.rpm > 0 && !player.isSelf;
			});
		}

		this.getMe = function() {
			return _.where(this.getPlayersAround(), {isSelf: true})[0];
		}

		this.getRelativePlayerPos = function(player) {
			var toReturn = {
				x: player.position.x <= 0 ? 0 : player.position.x,
				y: player.position.y <= 0 ? 0 : player.position.y,
			};

			console.log(toReturn);

			return toReturn;
		}

		this.run = function() {
			$('#playerList').html('');

			var players = _this.getPlayersAround();
			var desired = {
				x: 0,
				y: 0,
				type: 'mouseMoved',
			}

			_.each(players, function(player) {
				var color = (player.rpm > me.rpm) ? '#FF0000' : '#00FF00';

				var playerPos = _this.getRelativePlayerPos(player);

				if (player.rpm < (me.rpm * 0.8)) {
					desired.x += playerPos.x;
					desired.y += playerPos.y;
					desired.type = 'mouseDown';
				} else {
					desired.x += playerPos.x * -1;
					desired.y += playerPos.y * -1;

					if ((playerPos.x <= threshold && playerPos.x >= -threshold) || (playerPos.y <= threshold && playerPos.y >= -threshold)) {
						// console.warn('CLOSE');
						desired.type = 'mouseDown';
					}
				}


				$('#playerList').append('<b style="color: ' + color + '">' + player.playerName + '</b> (' + player.rpm + ')<br>');

				// if (_this.mode === 'aggresive') {
				// 	desired.x += _this.getRelativePlayerPos(player).x;
				// 	desired.y += _this.getRelativePlayerPos(player).y;
				// } else if (_this.mode === 'defensive') {
				// 	desired.x += _this.getRelativePlayerPos(player).x * -1;
				// 	desired.y += _this.getRelativePlayerPos(player).y * -1;
				// } else {
				// 	console.log('The fuck?');
				// }
			});

			_this.sendMovement(desired.x, desired.y, desired.type);

			if (!_this.disabled) {
				requestAnimationFrame(_this.run);
			}
		}

		this.run();
	};

	window.bot = new SpinzBot();
})();
