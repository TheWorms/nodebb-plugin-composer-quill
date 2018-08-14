'use strict';

/* globals define, socket, app, config, ajaxify, utils, templates, bootbox */

define('quill-nbb', [
    'quill',
    'composer',
    'translator',
    'composer/autocomplete',
    'composer/resize',
    'composer/formatting',
    'scrollStop',
    'components',
], function (Quill, composer, translator, autocomplete, resize, formatting, scrollStop, components) {
    function init (targetEl, data, callback) {
        var textDirection = $('html').attr('data-dir');
        var textareaEl = targetEl.siblings('textarea');
        var toolbarOptions = {
            container: [
                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],      // h1..h6
                ['bold', 'italic', 'underline', 'strike'],      // toggled buttons
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'script': 'sub'}, { 'script': 'super' }],    // superscript/subscript
                [{ 'color': [] }, { 'background': [] }],        // dropdown with defaults from theme
                [{ 'align': [] }],
                ['clean']
            ],
            handlers: {},
        };

        // Configure toolbar
        var toolbarHandlers = formatting.getDispatchTable();
        var group = [];
        data.formatting.forEach(function (option) {
            group.push(option.name);
            if (toolbarHandlers[option.name]) {
                toolbarOptions.handlers[option.name] = toolbarHandlers[option.name].bind(targetEl);
            }
        });
        toolbarOptions.container.push(group);

        // Quill...
        var quill = new Quill(targetEl.get(0), {
            theme: data.theme || 'snow',
            modules: {
                toolbar: toolbarOptions,
            }
        });
        targetEl.data('quill', quill);
        targetEl.find('.ql-editor').addClass('write');

        // Configure toolbar icons (must be done after quill itself is instantiated)
        data.formatting.forEach(function (option) {
            var toolbarEl = targetEl.siblings('.ql-toolbar').length ? targetEl.siblings('.ql-toolbar') : targetEl.find('.ql-toolbar');
            var buttonEl = toolbarEl.find('.ql-' + option.name);
            buttonEl.html('<i class="' + option.className + '"></i>');
            if (option.mobile) {
                buttonEl.addClass('visible-xs');
            }
        });

        // Automatic RTL support
        quill.format('direction', textDirection);
        quill.format('align', textDirection === 'rtl' ? 'right' : 'left');

        $(window).trigger('action:quill.load', quill);
        $(window).off('action:quill.load');

        // Restore text if contained in composerData
        if (data.composerData && data.composerData.body) {
            try {
                var unescaped = data.composerData.body.replace(/&quot;/g, '"');
                quill.setContents(JSON.parse(unescaped), 'api');
            } catch (e) {
                quill.setContents({"ops":[{"insert": data.composerData.body.toString()}]}, 'api');
            }
        }

        // Update textarea on text-change event. This allows compatibility with
        // how NodeBB handles things like drafts, etc.
        quill.on('text-change', function () {
            console.log(quill.getContents(), textareaEl);
            textareaEl.val(JSON.stringify(quill.getContents()));
        });

        // Handle tab/enter for autocomplete
        var doAutocomplete = function () {
            return !$('.composer-autocomplete-dropdown-' + data.post_uuid + ':visible').length;
        };
        [9, 13].forEach(function (keyCode) {
            quill.keyboard.addBinding({
                key: keyCode,
            }, doAutocomplete);
            quill.keyboard.bindings[keyCode].unshift(quill.keyboard.bindings[keyCode].pop());
        });

        // var options = {
        //     direction: textDirection || undefined,
        //     imageUploadFields: {
        //         '_csrf': config.csrf_token
        //     },
        //     fileUploadFields: {
        //         '_csrf': config.csrf_token
        //     },
        // };

        if (typeof callback === 'function') {
            callback();
        }
    };

    $(window).on('action:composer.loaded', function (ev, data) {
        var postContainer = $('.composer[data-uuid="' + data.post_uuid + '"]')
        var targetEl = postContainer.find('.write-container div');

        init(targetEl, data);

        var cidEl = postContainer.find('.category-list');
        if (cidEl.length) {
          cidEl.attr('id', 'cmp-cid-' + data.post_uuid);
        } else {
          postContainer.append('<input id="cmp-cid-' + data.post_uuid + '" type="hidden" value="' + ajaxify.data.cid + '"/>');
        }

        // if (config.allowTopicsThumbnail && data.composerData.isMain) {
        //   var thumbToggleBtnEl = postContainer.find('.re-topic_thumb');
        //   var url = data.composerData.topic_thumb || '';

        //   postContainer.find('input#topic-thumb-url').val(url);
        //   postContainer.find('img.topic-thumb-preview').attr('src', url);

        //   if (url) {
        //     postContainer.find('.topic-thumb-clear-btn').removeClass('hide');
        //   }
        //   thumbToggleBtnEl.addClass('show');
        //   thumbToggleBtnEl.off('click').on('click', function() {
        //     var container = postContainer.find('.topic-thumb-container');
        //     container.toggleClass('hide', !container.hasClass('hide'));
        //   });
        // }

        scrollStop.apply(targetEl);
        autocomplete.init(postContainer, data.post_uuid);
        resize.reposition(postContainer);
    });

    $(window).on('action:chat.loaded', function (e, containerEl) {
        // Create div element for composer
        var targetEl = $('<div></div>').insertBefore(components.get('chat/input'));

        var onInit = function () {
            autocomplete.init($(containerEl));
        }

        if (composer.formatting) {
            init(targetEl, {
                formatting: composer.formatting,
                theme: 'bubble',
            }, onInit);
        } else {
            socket.emit('plugins.composer.getFormattingOptions', function(err, options) {
                composer.formatting = options;
                init(targetEl, {
                    formatting: composer.formatting,
                    theme: 'bubble',
                }, onInit);
            });
        }
        // var composerEl = $(containerEl).find('[component="chat/composer"]');
        // var inputEl = composerEl.find('textarea.chat-input');

        // redactorify(inputEl, {
        //     height: 120,
        //     onChange: function () {
        //         var element = $('[component="chat/messages"]').find('[component="chat/message/remaining"]')
        //         var curLength = this.code.get().length;
        //         element.text(config.maximumChatMessageLength - curLength);
        //     }
        // });
    });

    // $(window).on('action:chat.sent', function (e, data) {
    //     // Empty chat input
    //     var redactor = $('.chat-modal[data-roomid="' + data.roomId + '"] .chat-input, .expanded-chat[data-roomid="' + data.roomId + '"] .chat-input').redactor('core.object');
    //     redactor.code.set('');
    // });
});
