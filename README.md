QuickIdeas Bugzilla Extension
=============================

This extensions adds a simple page for entering bugs in bugzilla as fast as you
can type. No confusing fields to fill in and wory about. No clicking through
sevral pages. Just type in the summary and description, hit tab couple of times
and the bug will be saving it self in the background. And you can already start
entering your next idea.

Installation
------------

This extension uses JSON RPC interface to interact with the bugzilla, so make
sure you have the required modules installed for Bugzilla. (They are required
by this extension so checksetup.pl will complain if you don't have them)

Follow the normal extension installation process and

1.  Put the extension files in

        extensions/QuickIdeas

2.  Run checksetup.pl

3.  Restart your webserver if needed (for exmple when running under `mod_perl`)

4.  Go to Bugzilla Administration > Parameters > QuickIdeas, and check the
    configuration values

5.  Make sure you have deafultplatform and defaultopsys set in
    Administrationn > Parameters > Bug Fields


Now you should see the big "Ener Ideas" link at the Bugzilla home page. And if
you have BayotBase extension installed, the "Enter Ideas" link will be available
at the top link row on every Bugzilla page.


Notes
-----

This extension ships with the required jQuery Javascript libraries so it can be
installed without [BayotBase][bb] extension, but you might be missing some
features in that case.

The "Clone" feature for cloning bugs from external sources requires that the
[SeeAlsoPlus][sap] extension is installed


[bb]: https://github.com/bayoteers/BayotBase
[sap]: https://github.com/bayoteers/SeeAlsoPlus


Included Libraries
------------------

*   [jQuery](http://jquery.com/)
*   [jQuery UI](http://jqueryui.com/)
*   [jQuery JSON RPC](https://github.com/datagraph/jquery-jsonrpc)

