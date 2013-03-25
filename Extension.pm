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

use JSON;

our $VERSION = '0.01';

sub page_before_template {
    my ($self, $params) = @_;

    if($params->{page_id} eq 'quickideas/enter.html') {
        Bugzilla->login(LOGIN_REQUIRED);
        my $vars = $params->{vars};
        my @components = _get_component_list();
        my $selectedcomponent = 0;
        for my $component (@components) {
            last if (Bugzilla->params->{quickideas_default_component} eq
                $component->{product}.'::'.$component->{name});
            $selectedcomponent += 1;
        }
        # Select the first if match not found
        $selectedcomponent = 0 if ($selectedcomponent == @components);

        $vars->{ideas_config} = encode_json({
            components => \@components,
            default_component => $selectedcomponent,
            defaults => {
                bug_severity => Bugzilla->params->{defaultseverity},
                rep_platform => Bugzilla->params->{defaultplatfirm},
                op_sys => Bugzilla->params->{defaultopsys},
                },
        });
        $vars->{extra_fields} = Bugzilla->params->{quickideas_extra_fields};

        $vars->{enable_clone} = Bugzilla->params->{quickideas_enable_clone}
        && eval {
            no warnings;
            require Bugzilla::Extension::SeeAlsoPlus::WebService;
        };

        $vars->{bb_available} = eval {
            no warnings;
            require Bugzilla::Extension::BayotBase::Config;
        } || 0;
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
    $args->{links}->{QuickIdeas} = [
        {
            text => "Enter Ideas",
            href => "page.cgi?id=quickideas/enter.html",
            priority => 1
        }
    ];
}

__PACKAGE__->NAME;
