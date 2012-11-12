# -*- Mode: perl; indent-tabs-mode: nil -*-
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (C) 2012 Jolla Ltd.
# Contact: Pami Ketolainen <pami.ketolainen@jollamobile.com>

package Bugzilla::Extension::QuickIdeas::Config;
use strict;
use warnings;

use Bugzilla::Config::Common;
use Bugzilla::Field;

sub get_param_list {
    my ($class) = @_;

    my @legal_severities = @{get_legal_field_values('bug_severity')};
    my @legal_components = @{Bugzilla->dbh->selectcol_arrayref(
        'SELECT CONCAT(P.name, \'::\', C.name) FROM components AS C '.
        'LEFT JOIN products P ON C.product_id = P.id '.
        'WHERE P.isactive = 1 ORDER BY P.name, C.name')};

    return ({
            name => 'quickideas_default_component',
            type => 's',
            choices => \@legal_components,
            default => $legal_components[0],
        }, {
            name => 'quickideas_default_severity',
            type => 's',
            choices => \@legal_severities,
            default => $legal_severities[0],
        }, {
            name => 'quickideas_extra_fields',
            type => 'm',
            choices => [qw(blocks depends_on estimated_time deadline url keywords cc)],
            default => [],
        }, {
            name => 'quickideas_enable_clone',
            type => 'b',
            default => 0,
        },
    );
}

1;
