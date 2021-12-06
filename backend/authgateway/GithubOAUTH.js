
import fetch from 'node-fetch';

export default class GithubOAUTH {
    static init(server, options) {
        const {clientId,  secret}=options;

        server.get("/github/authorize", async (req, res) => {
            res.redirect(`https://github.com/login/oauth/authorize?client_id=${clientId}`);
        });

        server.get("/github/auth_confirm", async (req, res) => {
            try {
                const code = req.query.code;
                if (!code.match(/^[0-9a-z]+$/i)){
                    res.end("error");
                    return;
                }
                const d = await fetch(`https://github.com/login/oauth/access_token?client_id=${clientId}&client_secret=${secret}&code=${code}`, {
                    method: "POST",
                    headers: {
                        "Accept": "application/json"
                    }
                }).then(res => res.json());
                res.end(`<html>
                <head>
                    <script>    
                        localStorage.setItem("gh_accessToken", "${d.access_token}");
                        window.close();
                        window.location.href = "/github/authorize/ok";
                    </script>
                </head>
                </html>`);
            } catch (e) {
                console.log(e);
            }
        });

        server.get("/github/authorize/ok", async (req, res) => {
            res.end("ok");
        });
    }

}

