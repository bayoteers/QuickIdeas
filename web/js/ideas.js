/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (C) 2012 Jolla Ltd.
 * Contact: Pami Ketolainen <pami.ketolainen@jollamobile.com>
 * Contributor(s):
 *   David Wilson
 *
 * Quick ideas enter page.
 *
 * This is the Javascript part of the ideas page, which is responsible for
 * allowing the user to quickly enter ideas without the overhead of selecting
 * multiple fields on the new_bug.cgi script.
 */

/**
 * Remove duplicate elements from an array.
 *
 * @param ar
 *      The array.
 */
function uniq(ar)
{
    for(var i = 0; i < ar.length; i++) {
        for(;;) {
            var idx = ar.lastIndexOf(ar[i]);
            if(idx == i) {
                break;
            } else {
                ar.splice(idx, 1);
            }
        }
    }
}


/**
 * Represent the behaviors of a single idea rendered on screen.
 */
$.widget('ideas.entryform', {
    /**
     * Deafult options, none at the moment
     */
    options: {},

    /**
     * Initialize the idea entry form
     */
    _create: function()
    {
        /** True if this has been or is being saved */
        this._saving = false;
        /** True when done event has been trigered. */
        this._done = false;

        this._render();
        this._fillComponents();
        this._setDefaults();

        var that = this;
        this.element.find(':input').not('#clone').each(function() {
            var input = $(this);
            var name = input.attr('name');
            if (name && that.options.values[name]) {
                input.val(that.options.values[name]);
                input.next('input.keep').prop('checked', true);
            }
        });
    },

    /**
     * Render ourselves in the DOM.
     */
    _render: function()
    {
        this._clone = $('#clone', this.element);
        this._clone.keydown($.proxy(this, '_onCloneKeydown'));

        this._component = $('.idea-component', this.element);
        this._summary = $('[name=summary]', this.element);
        this._description = $('[name=description]', this.element);

        this._progress = $('.progress', this.element);
        // To allow quick disabling.
        this._controls = $(':input', this.element);
        this._controls.not('.keep').keydown(
                $.proxy(this, '_onKeydown'));

        this._controls.not('.keep').last().keydown(
                $.proxy(this, '_onLastKeydown'));

        // Keyword autocomlete init
        $('[name=keywords]', this.element).each(function(index, input) {
            var container = $(input).siblings(".keywords_autocomplete").get(0);
            YAHOO.bugzilla.keywordAutocomplete.init(input, container);
        });

        // CC autocomplete
        $('[name=cc]', this.element).each(function(index, input) {
            var container = $(input).siblings(".cc_autocomplete").get(0);
            YAHOO.bugzilla.userAutocomplete.init(input, container, true);
        })
        this._summary.focus();
    },

    _setDefaults: function()
    {
        for (var field in IDEAS_CONFIG.defaults) {
            $("[name="+field+"]", this.element).val(IDEAS_CONFIG.defaults[field]);
        }
    },

    /**
     * Populate components selection control.
     */
    _fillComponents: function()
    {
        var that = this;
        var selected = this.options.values.component
        $.each(IDEAS_CONFIG.components, function(index, component)
        {
            var option = $('<option>')
                .attr('value', index)
                .text(component.title)
                .appendTo(that._component);
            if (index == selected) {
                option.prop('selected', true);
            }
        });
    },

    /**
     * Disable form controls
     */
    _disable: function() {
        this._controls.prop('disabled', true);
    },
    /**
     * Enable form controls
     */
    _enable: function() {
        this._controls.prop('disabled', false);
    },

    /**
     * On failed save, update the progress meter.
     */
    _onSaveFail: function(response)
    {
        var msg = response.error.message ? response.error.message :
            'Unknown error';
        this._progress.text('Failed: ' + msg);
        this._enable();
        this._saving = false;
    },

    /**
     * On successful save, record the bug ID we saved the idea as, and update
     * the progress indicator to link to the bug. If the resave flag is set,
     * enqueue a new RPC.
     */
    _onSaveDone: function(response)
    {

        this._bugId = response.result.id;
        var a = $('<a target="_new">').attr({
            href: 'show_bug.cgi?id=' + this._bugId
        });

        a.text('Bug #' + this._bugId);
        this._progress.html(a);

        if (this._cloneUrl) {
            this._rpc('Bug', 'update_see_also',
                {
                    ids: [this._bugId],
                    add: [this._cloneUrl],
                },
                undefined,
                $.proxy(this, '_updateSeeAlsoFail')
            );
        }
    },

    /**
     * Displays error message if setting the 'see also' field fails
     */
    _updateSeeAlsoFail: function(response)
    {
        this._progress.append('Failed to add see also URL ' + cloneOf + '<br/>');
    },

    /**
     * Cleanup blocks/depends_on field values
     */
    _sanitizeBlocksField: function(input)
    {
        var showBugRe = /.*show_bug.cgi.*id=([0-9]+)*/;
        var bits = $.trim(input.val()).split(/[, ]/);
        var ids = [];
        for(var i = 0; i < bits.length; i++) {
            var bit = $.trim(bits[i]);
            if(! bit) {
                continue;
            }

            var match = bit.match(showBugRe);
            if(match) {
                // URL; split out the ID.
                ids.push(+match[1]);
            } else if(+bit) {
                // Already an integer.
                ids.push(+bit);
            } else {
                this._progress.append('Invalid '+ input.attr('name') +' value.<br/>')
                return false;
            }
        }

        ids.sort(function(x, y) { return x - y });
        uniq(ids);
        input.val(ids.join(', '));
        return true;
    },

    /**
     * Cleanup any list field value
     */
    _sanitizeListField: function(input)
    {
        var bits = $.trim(input.val()).split(/[, ]/);
        var list = [];
        for(var i = 0; i < bits.length; i++) {
            var bit = $.trim(bits[i]);
            if(! bit) {
                continue;
            }
            list.push(bit);
        }
        uniq(list);
        input.val(list.join(', '));
        return true;
    },

    /**
     * Validate the idea state, updating the progress field as necessary.
     * Returns true if idea is valid.
     */
    _validate: function()
    {
        var that = this;
        var valid = true;
        this._progress.text('');
        this.element.find(':input').each(function() {
            var input = $(this);
            input.css("background", '');
            var name = input.attr('name');
            if (valid) input.focus();
            valid = that._check_required(input) && valid;
            if (name && that['_validate_'+name] != undefined) {
                valid = that['_validate_'+name](input) && valid;
            }
            return true;
        });
        return valid;
    },

    _check_required: function(input)
    {
        var labelth = input.parents('tr').first().find('th');
        var value = input.val();
        if(labelth.hasClass('required') && (!value || value == "---")) {
            var field = labelth.text().trim().slice(0, -1);
            this._progress.append(field + ' is required.<br/>');
            input.css('background', 'pink');
            return false;
        }
        return true;
    },
    _validate_summary: function(input)
    {
        if (input.val().length < 15) {
            this._progress.append('Title too short.<br/>');
            return false;
        }
        return true;
    },
    _validate_description: function(input)
    {
        if(input.val().length < 30) {
            this._progress.append('Description too short.<br/>');
            return false;
        }
        return true;
    },
    _validate_blocked: function(input)
    {
        return this._sanitizeBlocksField(input);
    },
    _validate_dependson: function(input)
    {
        return this._sanitizeBlocksField(input);
    },
    _validate_keywords: function(input)
    {
        return this._sanitizeListField(input);
    },
    _validate_cc: function(input)
    {
        return this._sanitizeListField(input);
    },

    /**
     * Start an RPC to save the idea, and bind to its events.
     */
    _save: function()
    {
        var ci = this._component.val();
        var params = {
            component: IDEAS_CONFIG.components[ci].name,
            product: IDEAS_CONFIG.components[ci].product,
            version: IDEAS_CONFIG.components[ci].version,
        };
        var keep = {
            component: ci,
        };
        this.element.find(':input').each(function() {
            var input = $(this);
            var name = input.attr('name');
            var value = input.val();
            if (name && value) {
                params[name] = value;
                if (input.next('input.keep').prop('checked')) {
                    keep[name] = value;
                }
            }
        });
        this._values = keep;

        this._saving = true;
        this._progress.text('Saving...');
        this._disable();

        this._rpc('Bug', 'create', params, $.proxy(this, "_onSaveDone"),
                $.proxy(this, "_onSaveFail"));
    },

    /**
     * Helper for calling RPC methods
     */
    _rpc: function(namespace, method, params, onSuccess, onError)
    {
        $.jsonRPC.setup({
            endPoint: 'jsonrpc.cgi',
            namespace: namespace,
        });
        $.jsonRPC.request(method, {
            params: [params],
            success: onSuccess,
            error: onError,
        });

    },

    /**
     * Handle CTRL+K key to toggle 'keep' checkbox, as they are 'skipped' in
     * the tabindex
     */
    _onKeydown: function(ev)
    {
        if(!(ev.keyCode == 75 && event.ctrlKey)) return;
        var element = $(ev.target);
        var keep = element.parents("td").first().find(".keep");
        if (keep.prop('checked')) {
            keep.prop('checked', false);
        } else {
            keep.prop('checked', true);
        }
        return false;
    },

    /**
     * Respond to tab being pressed in the last input field by saving the idea
     * via RPC.
     */
    _onLastKeydown: function(event)
    {
        if(! (event.keyCode == 9 && !event.shiftKey)) {
            return;
        }
        event.preventDefault();

        if(this._bugId) {
            return;
        }

        if(! this._validate()) {
            return;
        } else if(! this._saving) {
            this._save();
            // Only fire done event once; this avoids repeatedly recreating new
            // empty forms every time a server error occurs.
            if (!this._done) {
                this._done = true;
                this._trigger("done", null, {values: this._values });
            }
        }
    },

    /**
     * Respond to tab being pressed in the URL input field by fetching the
     * remote bug information.
     */
    _onCloneKeydown: function(event)
    {
        if(! (event.keyCode == 9 && !event.shiftKey)) {
            return;
        }
        var url = this._clone.val();
        if(! url) return;
        event.preventDefault();
        this._clone.css('background', null);
        this._disable();
        this._progress.text('Fetching...');
        this._rpc('SeeAlsoPlus', 'get',
                {
                    url: url, no_cache: 1,
                },
                $.proxy(this, '_fillIdeaEntry'),
                $.proxy(this, '_onCloneFail')
            );
    },

    /**
     * Display error message if fetching remote bug failed
     */
    _onCloneFail: function(response)
    {
        var msg = response.error.message ? response.error.message :
            'Unknown error';
        this._progress.append('Failed to fetch remote item: '
                + msg + '<br/>');
        this._clone.css('background', 'pink');
        this._enable();
    },

    /**
     * Fills the entry form with remote bug information
     */
    _fillIdeaEntry: function(response)
    {
        var result = response.result;
        this._progress.text('');
        this._cloneUrl = result.url;
        this._summary.val(result.summary);
        var head = ['---', result.description.author, 'on',
            result.description.date, '---'].join(' ');
        var description = 'From: ' + result.url + '\n' +
            head + '\n' +
            result.description.text + ' \n' +
            new Array(head.length + 1).join('-');
        this._description.val(description);
        this._enable();
        this._summary.focus();
    },

});

/**
 * Add new idea form to the page
 */
function ideasInitNew(values)
{
    element = $('#idea_template').clone().removeAttr('id');
    element.prependTo('#ideas');
    var options = {
        done: function(ev, data) {ideasInitNew(data.values)},
        values: values,
    }
    element.entryform(options);
}


$(document).ready(function()
{
    ideasInitNew({
        component: IDEAS_CONFIG.default_component,
    });
});
