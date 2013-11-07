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
        this._bug = new Bug(this.options.values, true);
        /** True if this has been or is being saved */
        this._saving = false;
        /** True when done event has been trigered. */
        this._done = false;

        this._inputs = {};
        this._keeps = {};

        this._render();

        var that = this;
        for (var name in this._inputs) {
            if (this.options.values[name] != undefined) {
                this._inputs[name].val(this.options.values[name]);
                this._keeps[name].prop('checked', true);
            }
        }
        this._bug.visibilityUpdated($.proxy(this, "_onVisibilityUpdate"));
        this._trigger("ready", null);
    },

    /**
     * Render ourselves in the DOM.
     */
    _render: function()
    {
        this._clone = $('input.clone', this.element);
        this._clone.keydown($.proxy(this, '_onCloneKeydown'));

        this._progress = $('.progress', this.element);

        var lastRow = this._progress.parents('tr').first();

        for(var i=0; i < IDEAS_CONFIG.fields.length; i++){
            var row = $("<tr>");
            var field = this._bug.field(IDEAS_CONFIG.fields[i]);
            if (!this._bug.isVisible(field)) row.hide();
            var input = this._bug.createInput(field, false, true)
                        .attr('tabindex', '2')
            this._inputs[field.name] = input;
            var th = $("<th>")
                .addClass('field_label')
                .append(this._bug.createLabel(field));
            if (field.is_mandatory) th.addClass('required');
            var td = $("<td>")
                .addClass('field_value')
                .append(input);
            row.append(th, td);
            var keep = $("<input>").attr({
                        type: 'checkbox',
                        tabindex: '0',
                        title: 'Preserve this field value for new ideas',
                    });
            this._keeps[field.name] = keep;
            row.append($("<td>").addClass("keep").append(keep));
            lastRow.before(row);
        }

        // To allow quick disabling.
        this._controls = $(':input', this.element);
        this._fields = this._controls.not('.clone,.keep input,button');

        // Bind key event handlers
        this._fields.keydown($.proxy(this, '_onKeydown'));
        this._fields.last().keydown($.proxy(this, '_onLastKeydown'));

        this.element.find("button[name=save]").click($.proxy(this, '_save'));
        this.element.find("input[name=summary]").focus();
    },
    _onVisibilityUpdate: function(bug, changed, field, isVisible)
    {
        var row = this.element.find('[name='+field+']')
                .parents('tr').first();
        if (isVisible) {
            row.show();
        } else {
            row.hide();
        }
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
    _onSaveFail: function(bug, error)
    {
        var msg = error.message ? error.message :
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
    _onSaveDone: function(bug)
    {
        var a = $('<a target="_new">').attr({
            href: 'show_bug.cgi?id=' + this._bug.id
        });

        a.text('Bug #' + this._bug.id);
        this._progress.html(a);

        if (this._cloneUrl) {
            this._rpc('Bug', 'update_see_also',
                {
                    ids: [this._bug.id],
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
    _updateSeeAlsoFail: function(error)
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
        var allValid = true;
        this._progress.text('');
        this._fields.each(function() {
            var input = $(this);
            input.css("background", '');
            var name = input.attr('name');
            if (allValid) input.focus();
            var inputValid = that._check_required(input);
            if (name && that['_validate_'+name] != undefined) {
                inputValid = that['_validate_'+name](input) && inputValid;
            }
            if (!inputValid) input.css('background', 'pink');
            allValid = inputValid && allValid;
            return true;
        });
        return allValid;
    },

    _check_required: function(input)
    {
        var name = input.attr('name');
        var value = input.val();
        var field = this._bug.field(name);
        if(this._bug.isMandatory(field) && (!value || value == "---")) {
            this._progress.append(field.display_name + ' is required.<br/>');
            return false;
        }
        return true;
    },
    _validate_summary: function(input)
    {
        if (input.val().length < 15) {
            this._progress.append('Summary too short.<br/>');
            return false;
        }
        return true;
    },
    _validate_comment: function(input)
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
        if(this._bug.id) {
            return;
        }
        if(this._saving || !this._validate()) {
            return;
        }

        var keep = {};
        for (var name in this._inputs) {
            if (this._keeps[name].prop('checked')) {
                keep[name] = this._inputs[name].val()
            }
        }
        this._values = keep;

        this._saving = true;
        this._progress.text('Saving...');
        this._disable();
        this._bug.save()
                .done($.proxy(this, "_onSaveDone"))
                .fail($.proxy(this, "_onSaveFail"))
        // Only fire done event once; this avoids repeatedly recreating new
        // empty forms every time a server error occurs.
        if (!this._done) {
            this._done = true;
            this._trigger("done", null, {values: this._values });
        }
    },

    /**
     * Helper for calling RPC methods
     */
    _rpc: function(namespace, method, params, onSuccess, onError)
    {
        var rpc = new Rpc(namespace, method, params);
        rpc.done(onSuccess);
        rpc.fail(onError);
    },

    /**
     * Handle CTRL+K key to toggle 'keep' checkbox, as they are 'skipped' in
     * the tabindex
     */
    _onKeydown: function(ev)
    {
        if(!(ev.keyCode == 75 && event.ctrlKey)) return;
        var name = $(ev.target).attr('name');
        var keep = this._keeps[name];
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

        this._save();
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
    _onCloneFail: function(error)
    {
        var msg = error.message ? error.message :
            'Unknown error';
        this._progress.append('Failed to fetch remote item: '
                + msg + '<br/>');
        this._clone.css('background', 'pink');
        this._enable();
    },

    /**
     * Fills the entry form with remote bug information
     */
    _fillIdeaEntry: function(result)
    {
        this._progress.text('');
        this._cloneUrl = result.url;
        this._inputs.summary.val(result.summary).change();
        var head = ['---', result.description.author, 'on',
            result.description.date, '---'].join(' ');
        var description = 'From: ' + result.url + '\n' +
            head + '\n' +
            result.description.text + ' \n' +
            new Array(head.length + 1).join('-');
        this._inputs.comment.val(description).change();
        this._enable();
        this._inputs.summary.focus();
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
        done: function(ev, data) {
            ideasInitNew(data.values)
            if (bvpInitTemplates != undefined) bvpInitTemplates();
        },
        values: values,
    }
    element.entryform(options);
}

function toggleHelp() {
    $("#help").fadeToggle();
    $(".help-hint").toggle();
}


$(document).ready(function()
{
    $(".help-hint").click(toggleHelp);

    if ($.cookie('quick_entry_seen_help') != 1) {
        // Help is initially hidden, we open it if user havent seen it already
        toggleHelp();
        $.cookie('quick_entry_seen_help', 1, {expires: 9999});
    }
    ideasInitNew({
        product: IDEAS_CONFIG.product,
        component: IDEAS_CONFIG.component,
        version: IDEAS_CONFIG.version,
        blocks: '',
    });
});
