Communications
==============
Packets are sent back and forth between the client and server using binary
Protocol Buffers over a WebSocket. Packets that are bidirectional will have an
additional origin field added to their body for responses. The communications
channel also has a cookie side-channel, used for authentication and initial
session data.

Authentication
--------------
Clients will send their authentication information in the cookie side-channel --
specifically, via a transient secure cookie (token) containing the user ID when
negotiating the SockJS connection. The token is created by the authentication
server, known as the mint.

Mint
~~~~
The mint is the authoritative source of tokens. Tokens must be minted by the
mint, as only the mint should possess the private key required for signing
tokens.

Tokens
~~~~~~
The format of a token is as follows:

 * n-bit signature for the remainder of the token, where n is the size of the
   RSA key used for signing -- recommended size is 2048.

 * 32-bit unsigned expiry time for the token.

 * Arbitrary length verified data, in plaintext.

The signature is computed using the mint's private key. The expiry time is also
decided by the mint -- all servers relying on the token must ensure the current
time does not exceed the timestamp specified by the expiry time. Servers can
verify that the cookie was in fact issued by the mint by checking the signature.
Tokens are designed to be used as a temporary proof of identity to another
server, so their expiry time is generally low (e.g. 10 minutes). As a
consequence of using RSA for signing, third-party servers can ensure that a
token is valid without having the capability to mint (or forge!) tokens.

The verified data the game server expects is of the form
authentication_realm.id. Tokens can belong to either the authentication realm
"user" or "npc_server". The expiry value determines the timestamp at which the
cookie should be expired -- after which the cookie is invalid a new cookie must
be issued from the mint. As credentials are used only during the initiation of a
SockJS connection, the expiry of a minted cookie will not disconnect the player
(but on disconnect will require the player to request a new cookie from the
mint).

The engine itself is never responsible for authenticating the user -- the user
must exchange proof of identity with the mint for a token. This document
intentionally omits details about authentication schemes for the mint -- this
can be done using various means, e.g. username/password, OpenID, OAuth.

Realm Server API
----------------
The realm server API on a publish/subscribe basis -- messages are published to
the server, and the server publishes responses back to the player. There is no
default functionality for the one-to-one correlation of responses to requests
(no RPC semantics), but messages may contain request identifiers to associate
requests to responses.

For a description of packet types, see ``proto/game.proto``.
