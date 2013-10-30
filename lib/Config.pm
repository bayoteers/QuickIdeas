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
use Bugzilla::Util qw(clean_text trim);
use Bugzilla::Version;

sub get_param_list {
    my ($class) = @_;

    my $dbh = Bugzilla->dbh;

    my @components = map {join("::", @$_)} @{
        $dbh->selectall_arrayref(
        'SELECT P.name, C.name FROM components AS C '.
        'LEFT JOIN products P ON C.product_id = P.id '.
        'WHERE P.isactive = 1 ORDER BY P.name, C.name')};
    my @groups = sort @{$dbh->selectcol_arrayref("SELECT name FROM groups")};
    unshift @groups, '';

    my @fields = qw(bug_severity priority rep_platform op_sys blocked
             dependson estimated_time deadline bug_file_loc keywords cc);
    push @fields, @{$dbh->selectcol_arrayref("SELECT name FROM fielddefs ".
        "WHERE custom = 1 AND obsolete = 0 AND enter_bug = 1")};

    return ({
            name => 'quickideas_group',
            type => 's',
            choices => \@groups,
            default => '',
        }, {
            name => 'quickideas_default_component',
            type => 's',
            choices => \@components,
            default => $components[0],
        }, {
            name => 'quickideas_default_version',
            type => 't',
            default => Bugzilla::Version::DEFAULT_VERSION,
            checker => \&_check_version
        }, {
            name => 'quickideas_extra_fields',
            type => 'm',
            choices => \@fields,
            default => [],
        }, {
            name => 'quickideas_enable_clone',
            type => 'b',
            default => 0,
        },
    );
}

sub _check_version {
    my $value = shift;
    return "" unless $value;
    my $version = Bugzilla::Version->match({value=>$value})->[0];
    return "Unknown version '$value'" unless defined $version;
    my $dbh = Bugzilla->dbh;
    my $products = $dbh->selectcol_arrayref(
        "SELECT name FROM products
                LEFT JOIN versions ON versions.product_id = products.id
                                  AND versions.value = ?
          WHERE versions.value IS NULL", undef, $version->name);
    if (scalar @$products) {
        return "Version '$value' is not available in products "
                .join(', ', @$products);
    }
    return "";
}

1;
