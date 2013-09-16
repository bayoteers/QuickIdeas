# -*- Mode: perl; indent-tabs-mode: nil -*-
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (C) 2012 Jolla Ltd.
# Contact: Pami Ketolainen <pami.ketolainen@jollamobile.com>
# Contributor(s):
#   David Wilson

package Bugzilla::Extension::QuickIdeas;
use strict;
use base qw(Bugzilla::Extension);

use Bugzilla;
use Bugzilla::Constants;
use Bugzilla::Error;

use JSON;
use List::MoreUtils qw(uniq);


our $VERSION = '0.01';

sub page_before_template {
    my ($self, $params) = @_;

    if($params->{page_id} eq 'quickideas/enter.html') {
        ThrowCodeError('quickideas_requires_bb') unless _bb_available();
        Bugzilla->login(LOGIN_REQUIRED);
        my $group = Bugzilla->params->{quickideas_group};
        ThrowUserError('auth_failure', {group => $group, action => 'access'})
            if ($group && !Bugzilla->user->in_group($group));

        my $vars = $params->{vars};

        my ($product, $component) = split(/::/,
                Bugzilla->params->{quickideas_default_component});

        my @fields = qw(product component summary comment);
        push(@fields, 'version') unless Bugzilla->params->{quickideas_default_version};
        push(@fields, 'platform') unless Bugzilla->params->{defaultplatform};
        push(@fields, 'op_sys') unless Bugzilla->params->{defaultopsys};
        my @mandatory_cf = map {$_->name} grep {$_->is_mandatory}
                Bugzilla->active_custom_fields;
        push(@fields, @mandatory_cf);
        push(@fields, @{Bugzilla->params->{quickideas_extra_fields}});
        @fields = uniq @fields;

        $vars->{ideas_config} = encode_json({
            product => $product,
            component => $component,
            version => Bugzilla->params->{quickideas_default_version},
            fields => \@fields,
        });

        $vars->{enable_clone} = Bugzilla->params->{quickideas_enable_clone}
        && eval {
            no warnings;
            require Bugzilla::Extension::SeeAlsoPlus::WebService;
        };
    }
}

# Return a sorted array of hashrefs describing components
sub _get_component_list {
    my ($items) = Bugzilla->dbh->selectall_arrayref(
        'SELECT '.
            "CONCAT(CL.name, ' :: ', P.name, ' :: ', CO.name) AS title, ".
            'CO.name, P.name, V.value '.
        'FROM components CO '.
        'LEFT JOIN products P ON (CO.product_id = P.id) '.
        'LEFT JOIN classifications CL ON (P.classification_id = CL.id) '.
        'LEFT JOIN versions V ON (V.product_id = P.id) '.
        'WHERE P.isactive = 1 '.
        'GROUP BY CO.id '.
        'ORDER BY title');

    return map { {
        title => $_->[0],
        name => $_->[1],
        product => $_->[2],
        version => $_->[3],
    } } @$items;
}

sub config_add_panels {
    my ($self, $args) = @_;
    my $modules = $args->{panel_modules};
    $modules->{QuickIdeas} = "Bugzilla::Extension::QuickIdeas::Config";
}

sub bb_common_links {
    my ($self, $args) = @_;
    return unless _user_can_access();
    $args->{links}->{QuickIdeas} = [
        {
            text => "Quick Entry",
            href => "page.cgi?id=quickideas/enter.html",
            priority => 1
        }
    ];
}

sub bb_group_params {
    my ($self, $args) = @_;
    push(@{$args->{group_params}}, 'quickideas_group');
}

sub install_before_final_checks {
    ThrowCodeError('quickideas_requires_bb') unless _bb_available();
}

sub template_before_process {
    my ($self, $args) = @_;
    if ($args->{file} eq 'index.html.tmpl') {
        $args->{vars}->{show_quickideas} =
            _bb_available() && _user_can_access() ? 1 : 0;
    }
}

sub _bb_available {
    return eval { require Bugzilla::Extension::BayotBase::Config };
}

sub _user_can_access {
    my $user = Bugzilla->user;
    my $group = Bugzilla->params->{quickideas_group};
    return !$group || $user->in_group($group);
}

__PACKAGE__->NAME;
