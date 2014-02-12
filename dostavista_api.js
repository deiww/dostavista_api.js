/**
 * Модуль для AJAX-работы с API Dostavista.ru.
 * Использует в качесте транспорта jQuery.ajax().
 * Зависит от jQuery 1.8 и старше.
 * 
 * @param  {Object} global window
 * @param  {Object} document document
 * @param  {Function} $ jQuery
 * 
 * @author Oleg Gromov <mail@oleggromov.com>
 */
(function DSTA(global, document, $) {
	/**
	 * Отключает ВСЕ сообщения плагина.
	 * @type {Boolean}
	 */
	var noDebug = false;

	var apiUrl = 'http://dostavista.ru/bapi/order';

	var clientId = null;
	var token = null;

	/**
	 * Выводит сообщение об ошибке в dev-консоль, если она доступна, либо делает alert.
	 * При noDebug == true ничего не делает вообще.
	 * 
	 * @param  {String} message Строка с сообщение об ошибке.
	 */
	var _error = function(message) {
		var fallback = function(message) { alert('dostavista_api.js: ' + message); };
		
		if (noDebug) return;

		if (console) {
			try {
				console.error(message);
			} catch(e) { fallback(message); }
		} else {
			fallback(message);
		}
	};

	if (typeof $ !== 'function') {
		_error('Для работы необходим jQuery версии 1.8 и старше.');
		return;
	}

	/**
	 * Сохраняет параметры для доступа к API.
	 * 
	 * @param  	{Object} params	Параметры clientId, token.
	 * @return 	{Boolean} true, если всё в порядке.
	 */
	var registerClient = function(params) {
		clientId = params.clientId || false;
		token = params.token || false;
	};

	/**
	 * Обрабатывает клик по кнопке, вызывая все необходимые хелперы. 
	 * 
	 * @param  {Object} e Объект-событие.
	 */
	var handleClick = function(e) {
		e.preventDefault();

		if (!clientId || !token) {
			_error('Установите clientId и token сразу после подключения плагина.');
			return;
		}

		var params = _parseArguments.call(this);
		try {
			_checkParams(params);
		} catch (e) {
			_error(e);
			return;
		}

		console.log('Параметры ОК');
		console.dir(params);
	};


	/**
	 * Достаёт из DOM-ноды все аргументы, валидирует их и преобразовывает в нужные типы.
	 * @TODO сделать нормальный парсинг телефона, даты
	 * 
	 * @return {Object} Хэш, в котором существующим в разметке ключам соответствуют их значения.
	 */
	var _parseArguments = function() {
		var toNumber = function(val) { return Number(val); }
		var toDate = function(val) { return Date(val); }
		var toPhone = function(val) { return val; }

		var attrs = [
			{ name: "dsta-matter" },
			{ name: "dsta-insurance", parse: toNumber },
			{ name: "dsta-point0_address" },
			{ name: "dsta-point0_time_start", parse: toDate },
			{ name: "dsta-point0_time", parse: toDate },
			{ name: "dsta-point0_contact" },
			{ name: "dsta-point0_phone", parse: toPhone },
			{ name: "dsta-point0_weight", parse: toNumber },
			{ name: "dsta-point0_taking", parse: toNumber },
			{ name: "dsta-point0_client_order_i" }
		];

		var params = {};

		var paramValue = null;
		for (var i = 0, max = attrs.length; i < max; i++) {
			paramValue = $(this).attr(attrs[i].name);
			if (paramValue) {
				params[attrs[i].name.replace('dsta-', '')] = attrs[i].parse ? attrs[i].parse(paramValue) : paramValue;
			}
		}

		return params;
	};


	/**
	 * Проверяет корректность параметров и бросает исключение, если что-то не так.
	 * @TODO сделать нормальную проверку телефона, времени.
	 * 
	 * @param  {Object} params Хэш с параметрами, полученный от _parseArguments.
	 * @return {[type]}        [description]
	 */
	var _checkParams = function(params) {
		var error = "";

		if (!params.matter) error += 'Не задан параметр matter.\n';
		if (!params['point0_address']) error += 'Не задан параметр point0_address.\n';
		if (!params['point0_phone']) error += 'Не задан параметр point0_phone.\n';
		if (!params['point0_time_start']) error += 'Не задан параметр point0_time_start.\n';
		if (!params['point0_time']) error += 'Не задан параметр point0_time.\n';
		if (!params['point0_weight']) error += 'Не задан параметр point0_weight.\n';

		if (error) {
			throw error;
		}
	}

	// Обработчики событий
	$(document).on('click', '.DSTA_button', handleClick);

	// Глобально доступный интерфейс.
	global.DSTA_Client = {
		register: registerClient
	};
})(window, document, jQuery);