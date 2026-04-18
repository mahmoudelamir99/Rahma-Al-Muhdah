import urllib.request
import urllib.parse
import json

def fetch_font():
    # Attempt 1: Search Github API
    query = 'filename:ae_AlMohanad.ttf'
    url = f'https://api.github.com/search/code?q={urllib.parse.quote(query)}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if data['items']:
                item = data['items'][0]
                download_url = item['html_url'].replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
                print(f'Downloading from: {download_url}')
                urllib.request.urlretrieve(download_url, 'ae_AlMohanad.ttf')
                print('Successfully downloaded ae_AlMohanad.ttf')
                return
            else:
                print('Not found in github search.')
    except Exception as e:
        print(f'Search error: {e}')

fetch_font()
