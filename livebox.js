;(function ($) {
    $.fn.livebox = function(options, chainOptions) {
		
		//=========================================================================================================================================

		/**
		 * Variable stores original parameters set passed to livebox on the moment of initialization
		 * This variable is read-only
		 * @type {{}}
		 */
		var settingsRaw = $.extend({}, options);
		
		/**
		 * Variable stores parameters of current livebox opened on the top level 
		 * Propertis of this variable may be modified by the script, eg `type` = `auto` may be changed to `selector`.
		 * settings <- defaults [<- common options] <- item settings <- this script runtime modifications
		 * @type {{}}
		 */
		var settings = {};
		
		//--------------------------------------------

		/**
		 * This variable contains events for current livebox
		 * Own events assigned in livebox config + common for chain elements events + system events
		 * @type {{}}
		 */
		var eventsHolder = {};

		/**
		 * This variable contains common settings for chained elements
		 * @type {{}}
		 */
		var chainCommonSettings = {};

		/**
		 * Flag showing wether one of chained elements was already initiated or not
		 * Needed for such things like event `beforefirstshow`.
		 * @type {boolean}
		 */
		var firstInitialized = false;

		/**
		 * Chained items array
		 * @type Array
		 */
		var chainedItems = [];

		/**
		 * Current active element in chain
		 * @type {number}
		 */
		var chainedItemsIndex = 0;

		/**
		 * Holder for BODY's current `top` CSS property
		 * @type {string}
		 */
		var topValue;

		/**
		 * Image object used in lightbox
		 * @type {Image}
		 * TODO Use JQuery obj eventually
		 */
		var img;

		/**
		 * Current image-element Image real width
		 * @type {number}
		 */
		var imgRealWidth = 0;
		
		/**
		 * Current image-element Image real height
		 * @type {number}
		 */
		var imgRealHeight = 0;

		/**
		 * Ajax object used in lightbox
		 * @type {jqXHR|null}
		 */
		var ajaxObject;

		/**
		 * Body shortcut
		 * @type {HTMLElement}
		 */
		var body = $('BODY');

		/**
		 * Flag (bool) set to true, if the box was dragged&dropped once
		 */
		var draggedOnce;

		/**
		 * Object with selectors cache (frame, box, overlay, content etc)
		 * @type {{}}
		 */
		var selectorCache = {};

		/**
		 * Lightbox identifier among its siblings
		 * @type {string}
		 */
		var ident = getRandomStr(8);

		/**
		 * Lightbox elements will get z-indexes starting this value and up
		 * Used only of top z-index element on page lower than this value
		 * @type {number}
		 */
		var baseZIndex = 1300;

		/**
		 * Z-position (not a z-index css value) of lightbox among to its siblings
		 * Only olened will get index '1', opened on top of it will get '2' etc.
		 * @type {number}
		 */
		var level = 0;

		/**
		 * Position of dragged box in percents
		 * @type {{left: number, top: number}}
		 */
		var dragPercPos = {
			left: 0,
			top: 0
		};

		/**
		 * @type {{}}
		 */
		var contentStorage = {};

		/**
		 * Default LiveBox settings
		 * @type {{}}
		 */
		var defaults = {

			type: 'auto',

			opacity: 0.6,
			
			animation: true,
			animationSpeed: 'fast',
			
			width: 500,
			height: 'auto',
			minHeight: 20,
			headerHeight: 35,
			
			closeButton: 'right', // 'left', 'right', 'out', 'none'
			closeOverlay: true,

			/**
			 * Allow to close lightbox by pressing Esc key
			 */
			closeEsc: true,
			
			overlayColor: '#000000',
			
			overflowx: 'auto',
			overflowy: 'auto',
			
			borderRadius: 10,
			
			padding: 10,
			
			noCache: false,
			preloadImages: true,
			shadow: true,

			loaderShape: false,

			headerNoHtml: true,
			headerContent: '',
			content: '',

			noExtraUi: false,
			
			contentScroll: true,

			// Popup top position
			// null - center
			// <int> number of pixels from the top
			// <int>% - top position in percents
			topPos: null,

			// Allow lightbox drag&drop (move) or not
			draggable: true,

			onOpen: null,

			/**
			 * For type `selector`:
			 * If true - dom elements will not be cloned, so changes to DOM elements will be preserved
			 * (including filled out form fields)
			 */
			preserveChanges: false
		};

		/**
		 * Settings for `loader` box 
		 * @type {{}}
		 */
		var spinnerConfig = {
			noEvents: true,
			height: 50,
			width: 50,
			loaderShape: true,
			closeButton: 'none',
			headerHeight: 0,
			padding: 0,
			borderRadius: 1000,
			contentScroll: false,
			content: '<div class="liveboxSpinner"></div>'
		};

		//=========================================================================================================================================
		
		/**
		 * Containe system events
		 * @type {{}}
		 */
		var internalEvents = {
			
			show: function () {
				if (settings.preloadImages) {
					preloadNextAndPrevImages();
				}
			},
			
			browserResize: function () {
				onBrowserWindowResize();
			},
			
			keyDown: function (param) {
				onKeyDown(param.event);
			}
		};
		
		//=========================================================================================================================================
		// Main logic
		
		// This is the start point
		init(this);
		

		/**
		 * Init lightbox
		 * @param el
		 */
		function init(el) {

			if (!window.liveboxesHideFuncs) {
				window.liveboxesHideFuncs = [];
			}
			window.liveboxesHideFuncs.push(hide);
			
			if (options === undefined) {
				return;
			}
			
			if (el.length) {
				
				// For case of "bind usage": $('#clickableElement').livebox({...})
				el.bind('click', function () {
					handleItems(options, chainOptions);
				});
				
			} else if (!el.length && !el.selector.length) {
				
				// For case of direct usage: $.fn.livebox({...});
				// including usage `class="livebox"`, because it eventually calls $.fn.livebox({...})
				handleItems(options, chainOptions);
				
			} else {
				// Elements not found
			}
		}

		/**
		 * Handle items/chains and common settings and general bindings
		 * @param {object|Array} items Lightbox configuration object OR an Array of configuration objects
		 * @param chainOptions
		 */
		function handleItems(items, chainOptions) {
			
			//----------------------------------------------------------
			// Resets
			
			selectorCache = {};
			
			//----------------------------------------------------------
			
			if (!$.isArray(items)) {
				items = [items];
			}
			chainedItems = items;
			
			chainedItemsIndex = 0;
			
			$.each(items, function (index, item) {
				if (item.active) {
					chainedItemsIndex = index;
				}
			});
			
			//----------------------------------------------------------
			
			if (typeof chainOptions === 'object') {
				chainCommonSettings = chainOptions;
			} else {
				chainCommonSettings = {};
			}
			
			//----------------------------------------------------------
			
			// If it is first opened lightbox in stack...
			if (!countOpenedBoxes()) {
				// ...save Y-scrollbar position
				setScrollPos(scrollbarYGetPos());
			}
			
			// Save current lightbox z-index position 
			level = countOpenedBoxes() + 1;
			
			//----------------------------------------------------------
			// Add elements to the page

			removeElemtnts();
			
			// Getting max z-index of element on the page, so we could put lightbox over it
			var cZIndex = getMaxZindex() > baseZIndex ? getMaxZindex() : baseZIndex;
			
			createElements();
			
			getBoxOverlay().css('z-index', cZIndex + 1);
			getBoxArrows().css('z-index', cZIndex + 2);
			getBoxCloseOutHolder().css('z-index', cZIndex + 3);
			getBoxFrame().css('z-index', cZIndex + 4);
			
			//----------------------------------------------------------
			// Handling clicks, keyboard events and resizes
			
			// Chaining arrows

			getBoxArrows().toggle(isChain());
			
			getBoxArrowRight().bind('click', function () {
				applyItemByIndex(getNextItemIndex());
			});
			
			getBoxArrowLeft().bind('click', function () {
				applyItemByIndex(getPrevItemIndex());
			});
			
			// Close buttons and overlay
			
			getBoxClose().bind('click', hide);
			getBoxCloseOut().bind('click', hide);
			getBoxOverlay().bind('click', overlayClick);
			
			// Window resize
			
			$(window).bind('resize.livebox_' + ident, function () {
				event('browserResize');
			});
			
			$(window).bind('keydown.livebox_' + ident, function (e) {
				event('keyDown', {event: e});
			});
			
			//----------------------------------------------------------
			
			applyItemByIndex(chainedItemsIndex);
			
			// Prevent following link, eg a[href=#]
			return false;
		}

		/**
		 * Handle single item/item in chain, applies event list, triggers events and initializes rendering
		 * @param options
		 */
		function handleItem(options) {
			
			// Initialize item
			applyOptions(options);
			handleItemEvents();
			handleDragNDrop();
			
			//----------------------------------------------------------
			// Trigger proper events
			
			// Only for first shown item
			if (!firstInitialized) {
				firstInitialized = true;
				
				if (event('beforefirstshow') === false) {
					hide();
					return;				
				}
			}

			// Every time when item is about to show
			if (event('beforeshow') === false) {
				hide();
				return;				
			}
			
			//----------------------------------------------------------
			
			handleContent();
			
			//----------------------------------------------------------
		}
		
		/**
		 * Prepare content depending on its type,
		 * preload (if needed) and place it into box
		 */
		function handleContent() {
			
			var boxContOuter = getBoxContentOuter();
			
			render();

			if (settings.type == 'image') {
				contHandlerImg();
			} else if (settings.type == 'ajax') {
				contHandlerAjax();
			} else if (settings.type == 'iframe') {
				contHandlerIframe();
			} else if (settings.type == 'youtube') {
				contHandlerYoutube();
			} else if (settings.type == 'selector') {
				contHandlerSelector();
			} else if (settings.type == 'text') {
				contHandlerText();
			} else if (settings.type == 'html') {
				contHandlerHtml();
			} else {
				console.error('Unknown LiveBox item type specified');
			}
			
			if (!isVisible()) {
				show();
			} else {
				posCenter();
			}
		}
		
		/**
		 * Apply visual settings to HTML frame
		 */
		function render() {
			
			var boxHeaderCont = getBoxHeaderCont();
			var boxOverlay = getBoxOverlay();
			var boxFrame = getBoxFrame();
			var boxContent = getBoxContent();
			var boxContentOuter = getBoxContentOuter();

			// Set lightbox header text
			if (settings.headerContent.length) {
				if (settings.headerNoHtml) {
					boxHeaderCont.text(settings.headerContent);
				} else {
					boxHeaderCont.html(settings.headerContent);
				}
			} else {
				boxHeaderCont.html('&nbsp;');
			}

			//-------------------------------------------------------------
			
			var extraSpace = getBodyAndHtmlExtraSpace();
			
			boxOverlay.css({
				'background-color': settings.overlayColor,
				opacity: settings.opacity,
				left: 0 - extraSpace.left,
				top: 0 - extraSpace.top
			});
			
			//-------------------------------------------------------------
			
			posCloseButton();

			boxContentOuter.css({
				width: settings.width,
				height: settings.height,
				minHeight: settings.minHeight,
				'overflow-x': settings.overflowx,
				'overflow-y': settings.overflowy
			});
			
			getBoxHeader().css({
				height: settings.headerHeight,
				width: settings.width
			});

			getBoxHeaderCont().css({
				height: settings.headerHeight
			});
			
			getBoxFrame().css({
				'border-radius': settings.borderRadius
			});

			if (!settings.shadow) {
				getBoxFrame().css({
					'box-shadow': 'none'
				});
			}

			boxContent.css({
				padding: settings.padding
			});
			
			if (settings.loaderShape) {
				getBoxFrame().addClass('liveboxRoundCorners');
			} else {
				getBoxFrame().removeClass('liveboxRoundCorners');
			}
			
			// Hide lightbox so it will be revealed noce and slowly
			boxFrame.css('opacity', 0);
			
			if (settings.type === 'image') {
				settings.contentScroll = false;
			}

			if (settings.contentScroll) {
				boxContent.removeClass('liveboxContentNoScroll');
				boxContentOuter.removeClass('liveboxContentNoScroll');
			} else {
				boxContent.addClass('liveboxContentNoScroll');
				boxContentOuter.addClass('liveboxContentNoScroll');
			}
		}
		
		function applyOptions(options) {
			
			//-------------------------------------------------------------

			if (options.noExtraUi) {
				options.headerHeight = 0;
				options.shadow = false;
				options.borderRadius = 0;
				options.padding = 0;
			}
			
			//-------------------------------------------------------------

			// Collect lightbox settings, defaults then user settings
			settings = $.extend({}, defaults, options);
			
			//-------------------------------------------------------------
			
			if (!isValidSize(settings.width)) {
				console.error('Param `width` has invalid value');
				return;
			}
			if (!isValidSize(settings.height)) {
				console.error('Param `height` has invalid value');
				return;
			}
			if (!isValidSize(settings.minHeight)) {
				console.error('Param `minHeight` has invalid value');
				return;
			}
			if (!isValidSize(settings.headerHeight)) {
				console.error('Param `headerHeight` has invalid value');
				return;
			}
			if (!isValidSize(settings.padding)) {
				console.error('Param `padding` has invalid value');
				return;
			}
			if (!isValidSize(settings.borderRadius)) {
				console.error('Param `borderRadius` has invalid value');
				return;
			}
			
			//-------------------------------------------------------------

			if (settings.type == 'auto') {
				settings.type = detectType(settingsRaw.content);
				if (settings.type === false) {
					settings.type = 'html';
					settings.content = liveBoxErrorMsg.replace('%content%', escape(settings.content));
					settings.padding = '10px';
				}
			}
			
			//-------------------------------------------------------------
			
			// Do not support drag&drop for 'image' type so far because in this case need to support lightbox 
			// relative-to-position-after-drag relocation in conjunction with resize, which is pain.
			if (settings.type === 'image') {
				settings.draggable = false;
			} else {
				//TODO restore flag from saved settings, if needed
			}
			
			//-------------------------------------------------------------
			
			draggedOnce = false;
			
			//-------------------------------------------------------------
		}

		function placeContent(content) {
			
			var boxCont = getBoxContent();

			if (typeof content == 'object') {
				boxCont.empty();
				boxCont.append(content);
			} else {
				boxCont.html(content);
			}

			boxCont.css({
				padding: settings.padding
			});

			// Elements with class `lbClose` should close current box on click
			//TODO Make it using
			boxCont.find('.lbClose').bind('click', hide);
		}
		
		function show() {
			
			var boxOverlay = getBoxOverlay();
			var boxFrame = getBoxFrame();

			updateOverlayHeight();
			
			if (settings.animation) {
				var opacity = boxOverlay.css('opacity');
				boxOverlay.css({opacity: .01}).animate({opacity: opacity}, settings.animationSpeed);
			}
			
			boxOverlay.show();
			boxFrame.show();
			
			if (settings.animation) {
				boxFrame.css({opacity: .01}).animate({opacity: 1}, settings.animationSpeed);
			}
			
			scrollbarsHide();

			var topOffset = parseInt($('body').css('top').match(/\d+/));
			
			getBoxScreen().css({'height': $(document).height()+'px', top: topOffset}).show();
			
			posCenter();
		}
		
		function animateOpening(type, callback) {
			
			var box = getBoxFrame();
			
			callback = typeof callback === 'function' ? callback : null;
			
			// Stop animation on element
			box.stop(true);
			
			if (!settings.animation) {

				box.show().css({opacity: 1});
				
				if (callback) {
					callback();
				}
				
				event('show');
				
				return;
			}
			
			if (type == 'fadein') {

				box.animate({opacity: 1}, settings.animationSpeed, function () {

					if (callback) {
						callback();
					}
					
					event('show');
				});
			
			// Only one animation type is supported by now
			} else {
				console.error('Invalid animation type: "' + type + '"');
			}
		}
		
		//=========================================================================================================================================
		// Content handlers
		
		function contHandlerImg() {
			
			var storedSettings = $.extend({}, settings);
			
			var url = settings.content;
			
			if (!imageIsCached(url)) {
				setupSpinner();
				animateOpening('fadein');
			}
			
			if (settings.noCache) {
				url += (url.indexOf('?') == -1 ? '?' : '&') + 'noCache=' + getRandomStr();
			}
			
			imagePreload(url, $.proxy(function (image) {
				
				// Set global object
				img = image;
				
				var el = $(img);

				// If maximum height is set for image
				if (parseInt(settingsRaw.width) && parseInt(settingsRaw.height)) {
					var reSize = calcImageSize(img.width, img.height, parseInt(settingsRaw.width), parseInt(settingsRaw.height));
					imgRealWidth = reSize.width;
					imgRealHeight = reSize.height;
				} else {
					
					if (parseInt(settingsRaw.width) || parseInt(settingsRaw.height)) {
						console.error('Parameters "width" and "height" for type "image" must be set both or none of them');
					}
					
					imgRealWidth = img.width;
					imgRealHeight = img.height;
				}

				
				restoreSettings(storedSettings);
				
				resizeForImage(imgRealWidth, imgRealHeight, null, true);
				
				placeContent(el);

				animateOpening('fadein');
				
			}, this));
		}

		function contHandlerAjax() {
			
			var storedSettings = $.extend({}, settings);
			
			setupSpinner();
			
			ajaxObject = $.ajax({
				type: 'get',
				dataType: 'html',
				url: settingsRaw.content,
				context: this,
				data: {},
				success: function (res) {
					
					restoreSettings(storedSettings);
					placeContent(res);

					if (isHeightAuto()) {
						var extraHeight = getExtraHeight();

						settings.height = getBoxContent().height();

						if (settings.height + extraHeight > $(window).height()) {
							settings.height = $(window).height() - extraHeight - 50;
						}

						getBoxContentOuter().css({
							height: settings.height + (settings.padding * 2)
						});
					}

					posCenter();
					
					animateOpening('fadein');
				},
				complete: function () {
					//...
				},
				error: function () {
					//...
				}
			});
			
		}
		
		function contHandlerIframe() {
			
			var storedSettings = $.extend({}, settings);
		
			setupSpinner();

			var iFrameTmp = $('<'+'iframe class="liveboxIframe" frameborder="no" framespacing="0" marginheight="0" marginwidth="0" allowtransparency="true" allowfullscreen></iframe>');
			iFrameTmp.attr('width', 10);
			iFrameTmp.attr('height', 10);
			iFrameTmp.attr('src', settingsRaw.content);

			var html = $('<div>').append(iFrameTmp.clone()).html();
			html = '<div><div class="liveboxSpinner"></div>' + html + '</div>';

			var iframeContent = $(html);
			var iframeObject = iframeContent.find('iframe');

			placeContent(iframeContent);
			
			iframeObject.bind('load', function () {
				restoreSettings(storedSettings);

				iframeContent.find('.liveboxSpinner').remove();

				iframeObject.css({
					width: settings.width,
					height: settings.height
				});

				if (isHeightAuto()) {
					var extraHeight = getExtraHeight();
					settings.height = iframeObject.contents().height();
					if (settings.height + extraHeight > $(window).height()) {
						settings.height = $(window).height() - extraHeight - 50;
					}

					iframeObject.css({
						height: settings.height
					});
				}

				getBoxContentOuter().css({
					width: settings.width + (settings.padding * 2),
					height: settings.height + (settings.padding * 2)
				});

				if (iframeObject.contents().height() > iframeObject.height()) {
					getBoxContent().css({
						'padding-right': 0
					});

					iframeObject.css({
						width: settings.width + settings.padding
					});
				}

				posCenter();

				animateOpening('fadein');

			});
		}
		
		function contHandlerYoutube() {

			var youtubeObj = $('<'+'iframe frameborder="0" allowfullscreen></iframe>');
			youtubeObj.attr('width', settings.width);
			youtubeObj.attr('height', settings.height);
			youtubeObj.attr('src', '//www.youtube.com/embed/'+escape(settings.content));
			
			getBoxContentOuter().css({
				width: settings.width + (settings.padding * 2),
				height: settings.height + (settings.padding * 2)
			});
			
			placeContent(youtubeObj);
			
			animateOpening('fadein');
		}
		
		function contHandlerSelector() {

			// Find target elements on page
			var el = $(settings.content);

			// Wrap content with placeholder so we will be able to return it back on its original place when livebox is closed
			// lbph - LiveBox Place Holder
			var wrappingEl = $('<div>').css('display', 'none').attr('lbph', ident);
			el.wrap(wrappingEl);

			// Take content out of its place and put in LiveBox content box
			var detached = el.detach();

			contentStorage[ident] = detached;

			var clone = settings.preserveChanges ? detached : detached.clone(true);
			placeContent(clone);

			animateOpening('fadein');
		}
		
		function contHandlerText() {
			placeContent(escape(settings.content));
			animateOpening('fadein');
		}
		
		function contHandlerHtml() {
			placeContent(settings.content);
			animateOpening('fadein');
		}
		
		//=========================================================================================================================================
		// Helper functions
		
		/**
		 * Detect content type by content string
		 * @param contString
		 * @returns {string|bool}
		 */
		function detectType(contString) {

			if (contString == undefined) {
				contString = '';
			}

			//----------------------------------
			// is it image link?
			
			if (isImageUrl(contString)) {
				return 'image';
			}
			
			//----------------------------------
			// is it ajax?

			if (contString.match(/^(http|ftp|https):\/\//gi) || contString.match(/^\//gi)) {
				return 'ajax';
			}
			
			//----------------------------------
			// is it selector
			
			if ($(contString).length) {
				return 'selector';
			}
			
			//----------------------------------

			return false;
		}
		
		function isHeightAuto() {
			return settings.height === undefined ||  (settings.height + '').toLowerCase() === 'auto';
		}

		/**
		 * Limit lightbox height by window size
		 */
		function updateMaxLightboxHeight() {
			var padding = 80;
			var maxHeight = isHeightAuto() ? $(window).height() - getExtraHeight() - padding : 'none';
			getBoxContentOuter().css('max-height', maxHeight);
		}
		
		function posCenter() {
			
			updateMaxLightboxHeight();

			var boxFrame = getBoxFrame();
			
			var pos = calculateBoxPos(boxFrame.width(), boxFrame.height());

			boxFrame.css({
				left: pos.left,
				top: pos.top
			});

			getBoxHeader().css({
				width: getBoxContentOuter().width()
			});
			
			posArrows();
		}

		/**
		 * Position lightbox after it was dragged from center, when user resizes browser window
		 */
		function posRecalculate() {
			
			updateMaxLightboxHeight();
			
			var frame = getBoxFrame();
			
			var framePos = getBoxFrame().position();
			
			var fieldWidth = $(window).width() - frame.width();
			var fieldLeftPx = fieldWidth / 100 * dragPercPos.left;
							
			var fieldHeight = $(window).height() - frame.height();
			var fieldTopPx = fieldHeight / 100 * dragPercPos.top;
							
			frame.css({
				left: fieldLeftPx,
				top: fieldTopPx
			});
		}

		/**
		 * Calculates box 'left' and 'top' for provided 'width' and 'height'
		 */
		function calculateBoxPos(width, height) {
			
			// We use `document` but not `window` to calculate position because only in
			// this way we can position livebox correctly in the middle of tall/wide document when it is scrolled to the middle
			var left = $(document).width() / 2 - width / 2;

			var top, perc;
			var topPos = settings.topPos + '';

			if (topPos.match(/^\d+$/)) {
				top = parseInt(topPos);
			} else if (perc = topPos.match(/^(\d+)%$/)) {
				//top = $(document).height() / 100 * perc[1];
				top = $(window).height() / 100 * perc[1];
			} else {
				//top = $(document).height() / 2 - height / 2;
				top = $(window).height() / 2 - height / 2;
				//top = top + getScrollPos();
			}
			
			return {
				left: left,
				top: top
			};
		}
		
		function posArrows() {
			var box = getBoxArrows();
			var top = ($(window).height() / 2) - (box.height() / 2);
			box.css('top', top);
		}
		
		function posCloseButton() {
			
			var pos = settings.closeButton;
			var closeBtn = getBoxClose();
			var closeOutBtn = getBoxCloseOut();
			
			closeBtn
				.removeClass('liveboxCloseBtnLeft')
				.removeClass('liveboxCloseBtnRight')
				.removeClass('liveboxCloseBtnNone');
			
			if (pos === 'left') {
				closeBtn.addClass('liveboxCloseBtnLeft');
			} else if (pos === 'right') {
				closeBtn.addClass('liveboxCloseBtnRight');
			} else {
				closeBtn.addClass('liveboxCloseBtnNone');
			}
			
			if (pos === 'out') {
				closeOutBtn.show();
			} else {
				closeOutBtn.hide();
			}
		}
		
		function createElements() {
			var tpl = liveBoxHtml;
			tpl = tpl.replace(/%ident%/g, ident);
			$('body').append(tpl);
		}
		
		function getPositionInPercent() {
			
			var frame = getBoxFrame();
			var framePos = getBoxFrame().position();
			
			var fieldWidth = $(window).width() - frame.width();
			var fieldLeft = framePos.left;
			var fieldPercLeft = (fieldLeft * 100 / fieldWidth);
			
			var fieldHeight = $(window).height() - frame.height();
			var fieldTop = framePos.top;
			var fieldPercTop = (fieldTop * 100 / fieldHeight);
			
			return {
				left: fieldPercLeft,
				top: fieldPercTop
			}
		}
		
		function handleDragNDrop() {
			
			var boxFrame = getBoxFrame();
			
			// Make lightbox draggable, if jqueryUI draggable module has been initiated
			if (typeof boxFrame.draggable == 'function') {
				
				// Allow dragging for this lightbox
				if (settings.draggable) {
					
					boxFrame.draggable({
						handle: findMy('.liveboxHeader'),
						containment: findMy('.liveboxScreen'),
						start: function () {
							draggedOnce = true;
						},
						drag: function () {
							
							var pos = getBoxFrame().position();
							
							dragPercPos = getPositionInPercent();
						}
					});
					
				// Disallow dragging for this lightbox
				} else {
					
					// For some reason i can not check that `draggable` was initiated using `boxFrame.draggable('instance')` and call `destroy` 
					// only if it was initiated - it throws an exception. So for now I will just catch any exception here and ignore it. 
					
					try {
						boxFrame.draggable('destroy');
					} catch (e) {
						// ignoring expected exception
					}
				}
			}
		}
		
		function getBodyAndHtmlExtraSpace() {
			
			var bodyEl = $('body');
			var htmlEl = $('html');
			
			var extraLeft = parseInt(bodyEl.css('padding-left')) 
					+ parseInt(bodyEl.css('margin-left')) 
					+ parseInt(bodyEl.css('border-left-width')) 
					+ parseInt(htmlEl.css('padding-left')) 
					+ parseInt(htmlEl.css('margin-left')) 
					+ parseInt(htmlEl.css('border-left-width'));

			var extraTop = parseInt(bodyEl.css('padding-top')) 
					+ parseInt(bodyEl.css('margin-top')) 
					+ parseInt(bodyEl.css('border-top-width')) 
					+ parseInt(htmlEl.css('padding-top')) 
					+ parseInt(htmlEl.css('margin-top')) 
					+ parseInt(htmlEl.css('border-top-width'));
			
			return {
				left: extraLeft,
				top: extraTop
			}
		}

		/**
		 * Restore lightbox settings according to lightbox defaults and options after it was changed manually or after rendering loading indicator
		 */
		function restoreSettings(storedSettings) {
			applyOptions(storedSettings);
			render();
		}
		
		function setupSpinner() {
			applyOptions(spinnerConfig);
			render();
			placeContent(spinnerConfig.content)
		}

		/**
		 * Set overlay height according document height
		 */
		function updateOverlayHeight() {
			// Set overlay height
			// We need in in case when you open overlay in the middle of tall page

			// Line with `$("html").prop("scrollHeight");` was commented because it does not work when
			// html tag is not covering whole page, for example in case when doctype is <!DOCTYPE html>
			// So had to switch to calculation based on window height
			//var height = getScrollPos() + $("html").prop("scrollHeight");

			var height = getScrollPos() + $(window).height();

			getBoxOverlay().css('height', height + 'px');
		}

		function findMy(selector) {
			return $('.liveboxOuter_' + ident).find(selector);
		}
		
		function signalOverlayUnclickable() {

			var box = getBoxFrame();
			
			var top = box.position().top;
			var left = box.position().left;
			
			box.animate({left: left + 10}, 50, function () {
				
				box.animate({left: left - 20}, 50, function () {
					
					box.animate({left: left}, 50, function () {
						//... signal ended
					});
				});
			});
			
		}
		
		function overlayClick() {
			
			if (event('overlayclick') === false) {
				return;				
			}
			
			var boxOverlay = getBoxOverlay();
			
			if (settings.closeOverlay) {
				//TODO In chain - disable for elements where `closeOverlay` is set to `true` 
				hide();
			} else {
				signalOverlayUnclickable();
			}
		}
		
		function hide() {
			
			//------------------------------------
			
			if (event('beforeclose') === false) {
				return;				
			}
			
			//------------------------------------
			// Stop actions/preventing handlers execution
			
			if (img) {
				img.onload = null;
			}
			
			if (ajaxObject) {
				ajaxObject.abort();
			}
			
			//------------------------------------
			
			var doClosingActions = function () {
				
				if (settings.type === 'selector') {

					// Returning detached content back on its place

					var elPlaceholder = $('[lbph=' + ident + ']');
					var contentEl = contentStorage[ident];
					delete contentStorage[ident];

					if (contentEl) {
						elPlaceholder.append(contentEl);
						contentEl.unwrap();
					}
				}

				removeElemtnts(true);

				event('close');
				
				if (getLevel() === 1) {
					event('afterlastclose');
				}
			};
			
			//------------------------------------
			
			if (settings.animation && settings.type != 'youtube') {
				
				getBoxFrame().animate({opacity: 0}, settings.animationSpeed);
				
				getBoxOverlay().animate({opacity: 0}, settings.animationSpeed, function () {
					doClosingActions();
				});
			} else {
				doClosingActions();
			}
			
			$(window).unbind('resize.livebox_'+ident);
			$(window).unbind('keydown.livebox_'+ident);
		}
		
		function countOpenedBoxes() {
			return $('.liveboxOuter').length;
		}
		
		function removeElemtnts(restoreScrollbars) {
			
			restoreScrollbars = typeof(restoreScrollbars) == 'undefined' ? false : restoreScrollbars;
			
			getBoxOuter().remove();
			
			if (restoreScrollbars && !countOpenedBoxes()) {
				scrollbarsRestore();
			}
		}
		
		function scrollbarYIsShown () {
			return $(document).height() > $(window).height();
		}

		function scrollbarXIsShown () {
			return $(document).width() > $(window).width();
		}

		function scrollbarYGetPos() {
			return $(document).scrollTop();
		}
		
		function scrollbarsHide() {

			// First: We disable scrollbar, not hide, becaise hiding leads to screen resize (scrollbar disappears) and this is distracting.
			// Second: We disable scollbars only when it is shown, because in other case class assignment forces scrollbar to reveals and this is not cute
			
			topValue = body.css('top');
			
			if (scrollbarYIsShown()) {
				body.addClass('liveboxNoScrollY')
					.css('top', '-' + getScrollPos() + 'px');
			}
			
			if (scrollbarXIsShown()) {
				body.addClass('liveboxNoScrollX');
			}
			
			body.addClass('liveboxNoScroll');
		}

		function scrollbarsRestore() {
			body.removeClass('liveboxNoScroll')
				.removeClass('liveboxNoScrollX')
				.removeClass('liveboxNoScrollY')
				.css('top', topValue)
				.scrollTop(getScrollPos());
		}
		
		function imageAddToCached(url) {
			
			if (settings.noCache) {
				return;
			}
		
			if (!window.liveboxImageCached) {
				window.liveboxImageCached = [];
			}
			
			if (!imageIsCached(url)) {
				window.liveboxImageCached.push(url);
			}
		}
		
		function imageIsCached(url) {
			
			if (settings.noCache) {
				return false;
			}
		
			if (window.liveboxImageCached && $.isArray(window.liveboxImageCached)) {
				for (var i = 0; i < window.liveboxImageCached.length; i++) {
					if (window.liveboxImageCached[i] === url) {
						return true;
					}
				}
			}
			
			return false;
		}
		
		function imagePreload(url, callback) {
			
			var img = new Image();
			img.onload = function (event) {
				if (typeof callback == 'function') {
					imageAddToCached(url);
					callback(img, event);
				}
			};
			img.src = url;
		}

		/**
		 * Return height of additional elements (besides content itself) and paddings which increase total height of livebox
		 * @returns {number}
		 */
		function getExtraHeight() {
			return getBoxHeader().height() + settings.padding * 2;
		}

		/**
		 * Return width of additional elements (besides content itself) and paddings which increase total width of livebox
		 * @returns {number}
		 */
		function getExtraWidth() {
			return settings.padding * 2;
		}
		
		function setScrollPos(val) {
			window.liveboxScrollPos = val;
		}
		
		function getScrollPos() {
			return window.liveboxScrollPos ? window.liveboxScrollPos : 0;
		}
		
		function getLevel() {
			return level;
		}
		
		function isVisible() {
			return !!getBoxFrame().is(':visible');
		}

		/**
		 * @param width Actual image with
		 * @param height Actual image height
		 * @param maxWidth Desired image max width
		 * @param maxHeight Desired image max height
		 * @returns Object
		 */
		function calcImageSize(width, height, maxWidth, maxHeight) {
			
			maxWidth = parseInt(maxWidth) ? parseInt(maxWidth) : 0;
			maxHeight = parseInt(maxHeight) ? parseInt(maxHeight) : 0;
			
			var widthOrig = width;
			var heightOrig = height;
			var ratioW = width/height;
			var ratioH = height/width;
			
			var overlayPadding = 100;
			var windowWidth = $(window).width();
			var windowHeight = $(window).height();

			var totalWidth = getExtraWidth() + width;
			var totalHeight = getExtraHeight() + height;
			var arrowsExtraPadding = isChain() ? 100 : 0;
			
			//-------------------------------------------------
			
			var maxImgWidth = maxWidth ? maxWidth : (windowWidth - getExtraWidth() - overlayPadding - arrowsExtraPadding); 
			var maxImgHeight = maxHeight ? maxHeight : (windowHeight - getExtraHeight() - overlayPadding);
			
			if (maxImgWidth > width) {
				maxImgWidth = width;
			}
			
			if (maxImgHeight > height) {
				maxImgHeight = height;
			}
			
			//-------------------------------------------------
			// Not cutest algo, must be redone
			
			// Recalculate size if one of sedes bigger than maximum
			if (totalWidth > maxImgWidth) {
				width = maxImgWidth;
				height = maxImgWidth/ratioW;
			}
			if (totalHeight > maxImgHeight) {
				height = maxImgHeight;
				width = maxImgHeight/ratioH;
			}
			
			// If after recalculation one of sides still exceeds maximum - shrinking image using overflowing side as maximum
			if (width > maxImgWidth) {
				width = maxImgWidth;
				height = maxImgWidth/ratioW;
			}
			if (height > maxImgHeight) {
				height = maxImgHeight;
				width = maxImgHeight/ratioH;
			}
			
			if (width > widthOrig || height > heightOrig) {

			}
			
			//-------------------------------------------------
			
			var paddings = settings.padding * 2;
			
			return {
				
				// Image height and width
				height: height,
				width: width,
				
				// Image height and width + padding, so it makes size of all the content block
				heightPadding: height + paddings,
				widthPadding: width + paddings
			};
		}
		
		function resize(width, height, callback, disableAnimation) {
			
			if (event('beforeresize') === false) {
				return;				
			}
			
			disableAnimation = typeof disableAnimation == 'boolean' ? disableAnimation : false;
			
			settings.width = width;
			settings.height = height;
			
			var pos = calculateBoxPos(width, height);
			var boxFrame = getBoxFrame();
			
			var afterResize = function () {
				
				event('resize');
				
				if (typeof callback == 'function') {
					callback();
				}
			};
			
			if (settings.type == 'image') {
				//...
			}
			
			if (settings.animation && !disableAnimation) {

				getBoxContentOuter().animate({
					width: settings.width,
					height: settings.height
				});
				
				getBoxHeader().animate({
					width: width
				});
				
				boxFrame.animate({
					left: pos.left,
					top: pos.top
				}, afterResize);
				
			} else {
				
				getBoxContentOuter().css({
					width: settings.width,
					height: settings.height
				});
				
				getBoxHeader().css({
					width: width
				});
				
				boxFrame.css({
					left: pos.left,
					top: pos.top
				});
				
				afterResize();
			}
			
		}

		/**
		 * @param events 
		 */
		function eventsAdd(events) {
			if (typeof events === 'object') {
				$.each(events, function (name, callback) {
					eventAdd(name, callback);
				});
			} else {
				eventsReset();
			}
		}

		/**
		 */
		function eventsReset() {
			eventsHolder = {};
		}
		
		function handleItemEvents() {
			eventsReset();
			
			eventsAdd(getItemByIndex(chainedItemsIndex).events);
			
			if (chainCommonSettings) {

				// Apply common for all items in chain options
				options = $.extend({}, chainCommonSettings, options);
				
				// Apply common for all items events
				if (chainCommonSettings.events) {
					eventsAdd(chainCommonSettings.events);
				}
			}
			
			eventsAdd(internalEvents);
		}
		
		function event(name, args) {
			
			args = (typeof args === 'object') ? args : {};
			
			if (settings.noEvents) {
				return;
			}
			
			if (!eventsHolder[name]) {
				return;
			}
			
			var cbResult;
			
			//TODO Clone objects here, check funcs
			var params = {
				settings: settings,
				settingsRaw: settingsRaw,
				content: getBoxContent()
			};
			
			var callbackParam = $.extend({}, args, params);
			
			$.each(eventsHolder[name], function(index, callback) {
				if (typeof callback === 'function') {
					if (callback(callbackParam) === false) {
						cbResult = false;
					}
				}
			});
			
			return cbResult;
		}

		/**
		 * 
		 * @param name Event name
		 * @param callback
		 */
		function eventAdd(name, callback) {
			
			if (eventsHolder[name] === undefined) {
				eventsHolder[name] = [];
			}
			
			eventsHolder[name].push(callback);
		}
		
		function preloadNextAndPrevImages() {
			
			if (!isChain()) {
				return;
			}
			
			var idNext = getNextItemIndex();
			var idPrev = getPrevItemIndex();
			
			var itemNext = getItemByIndex(idNext);
			if (isImageUrl(itemNext.content)) {
				imagePreload(itemNext.content);
			}
			
			if (idNext !== idPrev) {
				var itemPrev = getItemByIndex(idPrev);
				if (isImageUrl(itemPrev.content)) {
					imagePreload(itemPrev.content);
				}
			}
		}
		
		function resizeForImage(width, height, callback, disableAnimation) {
			
			var imSize = calcImageSize(width, height);
			
			img.width = imSize.width;
			img.height = imSize.height;
			
			var afterResizeCallback = function () {
				
				// Mostly we need this for correct repositioning of the lightbox if scrollbars are present
				posCenter();
				
				if (typeof callback == 'function') {
					callback();
				}
			};
			
			resize(imSize.widthPadding, imSize.heightPadding, afterResizeCallback, disableAnimation);
		}
		
		function getNextItemIndex() {
			
			if (!isChain()) {
				return chainedItemsIndex;
			}
			
			var index = chainedItemsIndex + 1;
			if (index === chainedItems.length) {
				index = 0;
			}
			
			return index;
		}
		
		function getPrevItemIndex() {
			
			if (!isChain()) {
				return chainedItemsIndex;
			}
			
			var index = chainedItemsIndex - 1;
			if (index < 0 ) {
				index = chainedItems.length - 1;
			}
			
			return index;
		}
		
		function getItemByIndex(index) {
			return chainedItems[index];
		}
		
		function applyItemByIndex(index) {
			chainedItemsIndex = index;
			handleItem(getItemByIndex(chainedItemsIndex));
		}
		
		function isChain() {
			return chainedItems.length > 1;
		}
		
		//----------------------------------------------------------------------------
		
		function onBrowserWindowResize() {
			
			//var height = $(document).height();
			var height = $(window).height();
			
			getBoxScreen().css({'height': height + 'px'});
			
			updateOverlayHeight();
			
			if (settings.type === 'image') {
				resizeForImage(imgRealWidth, imgRealHeight, null, true);
			}
			
			if (!draggedOnce) {
				posCenter();
			} else {
				posRecalculate();
			}
		}

		function onKeyDown(event) {
			
			// Do not perform action on lightboxes which are not on top level
			if (countOpenedBoxes() !== getLevel()) {
				return;
			}
			
			if (event.keyCode == 27) { // ESC

				if (settings.closeEsc) {
					hide();
				}
			}
			
			if (isChain()) {
				if (event.keyCode === 37) {
					applyItemByIndex(getPrevItemIndex());
				} else if (event.keyCode === 39) {
					applyItemByIndex(getNextItemIndex());
				}
			}

		}

		//----------------------------------------------------------------------------
		// Getters
		// TODO Compact this code
		
		function getBoxCloseOutHolder() {
			if (!selectorCache.closeOutHolder || !selectorCache.closeOutHolder.length) {
				selectorCache.closeOutHolder = findMy('.liveboxOuterCloseBtnHolder');
			}
			return selectorCache.closeOutHolder;
		}
		
		function getBoxCloseOut() {
			if (!selectorCache.closeOut || !selectorCache.closeOut.length) {
				selectorCache.closeOut = findMy('.liveboxOuterCloseBtn');
			}
			return selectorCache.closeOut;
		}

		function getBoxClose() {
			if (!selectorCache.boxClose || !selectorCache.boxClose.length) {
				selectorCache.boxClose = findMy('.liveboxCloseBtn');
			}
			return selectorCache.boxClose;
		}
		
		function getBoxArrows() {
			if (!selectorCache.boxArrBox || !selectorCache.boxArrBox.length) {
				selectorCache.boxArrBox = findMy('.liveboxArrows');
			}
			return selectorCache.boxArrBox;
		}
		
		function getBoxArrowLeft() {
			if (!selectorCache.boxArrLeft || !selectorCache.boxArrLeft.length) {
				selectorCache.boxArrLeft = findMy('.liveboxArrowLeft');
			}
			return selectorCache.boxArrLeft;
		}
		
		function getBoxArrowRight() {
			if (!selectorCache.boxArrRight || !selectorCache.boxArrRight.length) {
				selectorCache.boxArrRight = findMy('.liveboxArrowRight');
			}
			return selectorCache.boxArrRight;
		}
		
		function getBoxFrame() {
			if (!selectorCache.boxFrame || !selectorCache.boxFrame.length) {
				selectorCache.boxFrame = findMy('.liveboxFrame');
			}
			return selectorCache.boxFrame;
		}
		
		function getBoxOverlay() {
			if (!selectorCache.boxOverlay || !selectorCache.boxOverlay.length) {
				selectorCache.boxOverlay = findMy('.liveboxOverlay');
			}
			return selectorCache.boxOverlay;
		}
		
		function getBoxOuter() {
			if (!selectorCache.boxOuter || !selectorCache.boxOuter.length) {
				selectorCache.boxOuter = $('.liveboxOuter_'+ident);
			}
			return selectorCache.boxOuter;
		}
		
		function getBoxScreen() {
			if (!selectorCache.boxScreen || !selectorCache.boxScreen.length) {
				selectorCache.boxScreen = findMy('.liveboxScreen');
			}
			return selectorCache.boxScreen;
		}
		
		function getBoxContent() {
			if (!selectorCache.boxContent || !selectorCache.boxContent.length) {
				selectorCache.boxContent = findMy('.liveboxContent');
			}
			return selectorCache.boxContent;
		}
		
		function getBoxContentOuter() {
			if (!selectorCache.boxContentOuter || !selectorCache.boxContentOuter.length) {
				selectorCache.boxContentOuter = findMy('.liveboxContentOuter');
			}
			return selectorCache.boxContentOuter;
		}
		
		function getBoxHeader() {
			if (!selectorCache.boxHeader || !selectorCache.boxHeader.length) {
				selectorCache.boxHeader = findMy('.liveboxHeader');
			}
			return selectorCache.boxHeader;
		}

		function getBoxHeaderCont() {
			if (!selectorCache.boxHeaderCont || !selectorCache.boxHeaderCont.length) {
				selectorCache.boxHeaderCont = findMy('.liveboxHeaderCont');
			}
			return selectorCache.boxHeaderCont;
		}
		
		//----------------------------------------------------------------------------
		// Public methods
		
		this.close = function () {
			hide();
		};
		
		this.center = function () {
			posCenter();
		};

		this.resize = function (width, height, callback, disableAnimation) {
			resize(width, height, callback, disableAnimation);
		};

		//----------------------------------------------------------------------------
		// Utils

		/**
		 * Escape html in string
		 * @param string
		 * @returns {XML}
		 */
		function escape(string) {
			var res = $('<div/>').text(string).html();
			return res.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
		}

		/**
		 * Get timestamp
		 * @param {string} format [Optional]: 'regular', 'underscores', 'mono', 'us'
		 * @returns {string}
		 */
		function getTimestamp(format) {
			
			format = typeof(format) == 'undefined' ? 'regular' : format;
			
			var currentdate = new Date();
			
			var addLearingZero = function (num) {
				num = ''+num;
				return num.length == 1 ? '0'+num : num;
			};
			
			var year = currentdate.getFullYear();
			var month = addLearingZero(currentdate.getMonth() + 1);
			var day = addLearingZero(currentdate.getDate());
			var hour = addLearingZero(currentdate.getHours());
			var minute = addLearingZero(currentdate.getMinutes());
			var second = addLearingZero(currentdate.getSeconds());
			
			var timestamp;
			
			if (format == 'underscores') {
				timestamp = year+'_'+month+'_'+day+'_'+hour+'_'+minute+'_'+second;
			} else if (format == 'mono') {
				timestamp = year+month+day+hour+minute+second;
			} else if (format == 'us') {
				timestamp = day+'/'+month+'/'+year+' '+hour+':'+minute+':'+second;
			} else {
				timestamp = year+'-'+month+'-'+day+' '+hour+':'+minute+':'+second;
			}
			
			return timestamp;
		}

		/**
		 * Check if value valid size for DIV
		 * @param {string|number} val - number/string to check
		 * @param {bool} [allowAuto] Allow value 'auto'
		 * @returns {bool}
		 */
		function isValidSize(val, allowAuto) {
			allowAuto = typeof(allowAuto) == 'undefined' ? true : !!allowAuto;
			
			if (isNumeric(val)) {
				return true;
			}
			
			//noinspection RedundantIfStatementJS
			if (allowAuto && val === 'auto') {
				return true;
			}
			
			return false;
		}

		/**
		 * Check if string contains only digits
		 * @param {string|number} val - number/string to check
		 * @returns {bool}
		 */
		function isNumeric (val) {
			val = ''+val;
			return !!val.match(/^-?\d+$/);
		}
		
		function getRandomStr(length) {
			
			if (!length) {
				length = 8;
			}

			var rndStr = '';
			var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
			
			for(var i=0; i < length; i++ ) {
				rndStr += chars.charAt(Math.floor(Math.random() * chars.length));
			}
			
			return rndStr;
		}
		
		function getMaxZindex() {
			
			var top = 0;
			
			$('*').each(function() {
				
				var current = parseInt($(this).css('z-index'), 10);
				
				if(current && top < current) {
					top = current;
				}
			});
			
			return top;
		}
		
		function isImageUrl(url) {

			//TODO Redo this function
			
			if (!url) {
				return false;
			}

			var imgExtensions = ['jpg', 'jpeg', 'gif', 'png', 'bmp', 'webp'];
			
			for (var index in imgExtensions) {
				if (imgExtensions.hasOwnProperty(index)) {
					var regexp = new RegExp('\\.' + imgExtensions[index] + '(\\?.+)?$', 'gi');
					if (url.match(regexp)) {
						return true;
					}
				}
			}
			
			return false;
		}
		
		//----------------------------------------------------------------------------
		
		return this;
    };

	//TODO Do it in right way, this is temporary solution
	$.fn.livebox.hideAll = function () {
		var hs = window.liveboxesHideFuncs;
		for (var i = 0; i < hs.length; i++) {
			hs[i]();
		}
	};

}(jQuery));

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Autorun
jQuery(function () {

	var $ = jQuery;

	var linksSelector = '.liveBox, .livebox';

	if (typeof $(document).on === 'function') {
		$(document).on('click', linksSelector, onElementClick);
	} else {
		$(linksSelector).live('click', onElementClick);
	}

	function onElementClick() {

		var el = $(this);
		
		var options;
		var chain;
		
		// Get random string
		var marker = Math.random().toString(36).slice(2);
		
		// Mark element as invoker
		el.data('marker', marker);
		
		var rel = el.attr('rel');
		if (rel) {
			chain = $('[rel='+rel+']');
		}
		
		// Chain provided
		if (chain && chain.length) {
			
			options = [];
			
			$.each(chain, function (index, chainEl) {
				chainEl = $(chainEl);
				
				var item = extractOptions(chainEl);
				
				if (chainEl.data('marker') === marker) {
					item.active = true;
				}
				
				options.push(item);
			});
			
		// Single element provided
		} else {
			options = extractOptions(el);
		}
		
		$.fn.livebox(options);
		
		return false;
	}
	
	function extractOptions(el) {

		var options = el.data('livebox');
		
		if (typeof options != 'object') {
			options = {};
		}
		
		if (el.attr('href') !== undefined) {
			options.content = el.attr('href');
		}
		
		return $.extend({}, options);
	}
	
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


var liveBoxHtml = " \
	<div class='liveboxOuter liveboxOuter_%ident%'>\
		<div class='liveboxOverlay'></div> \
		<div class='liveboxOuterCloseBtnHolder'>\
			<div class='liveboxOuterCloseBtn'></div>\
		</div> \
		<div class='liveboxArrows'>\
			<div class='liveboxArrowLeft'></div> \
			<div class='liveboxArrowRight'></div> \
		</div> \
		<div class='liveboxScreen'> \
			<div class='liveboxFrame'> \
				<div class='liveboxHeader'> \
					<div class='liveboxCloseBtn'></div> \
					<div class='liveboxHeaderCont liveboxHeaderContStyle'>&nbsp;</div> \
				</div> \
				<div class='liveboxContentOuter'><div class='liveboxContent'></div></div> \
			</div> \
		</div> \
	</div>\
";

//TODO Move styles to .css file

var liveBoxErrorMsg = " \
	<style type='text/css'>\
		.lbeMarker {\
			background-color: #e4e4e4;\
			font-family: 'Consolas', 'Courier New', Courier, mono, serif;\
			padding: 0 5px 3px 7px;\
		}\
		\
		.lbeRed {\
			color: red;\
		}\
		\
		.lbeHPadding {\
			margin-top: 5px;\
		}\
	</style>\
	<div>\
		<b class='lbeRed'>Error:</b> Unable to auto-detect content type for <span class='lbeMarker'>%content%</span><br> \
	<div>\
	<div class='lbeHPadding'>\
		Please, specify content type using parameter <span class='lbeMarker'>type</span> \
	<div>\
";