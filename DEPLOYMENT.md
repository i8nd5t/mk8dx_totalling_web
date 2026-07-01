# デプロイ手順

このアプリは完全静的アプリです。サーバー、DB、WebSocket、ビルド処理は不要です。

## GitHub Pages

このリポジトリには `.github/workflows/pages.yml` を用意しています。

手順:

1. GitHubにリポジトリを作成する
2. このリポジトリをpushする
3. GitHubの `Settings` -> `Pages` を開く
4. `Build and deployment` のSourceを `GitHub Actions` にする
5. `master` または `main` にpushすると自動デプロイされる

ビルドコマンドは不要です。

## Cloudflare Pages

Cloudflare Pagesでもそのまま配信できます。

推奨設定:

```text
Framework preset: None
Build command: 空欄
Build output directory: /
Root directory: /
```

Cloudflare PagesはHTTPSが自動で有効になります。画面共有 `getDisplayMedia` を使うため、本番公開ではHTTPSが必要です。

## ローカル確認

```bash
python3 -m http.server 8000
```

```text
http://localhost:8000/
```

## デプロイ前チェック

```bash
python3 -m pytest -q -s
```

確認項目:

- 管理UIが表示される
- 1レース目を手入力できる
- overlay previewが更新される
- Reset Allできる
- 画面共有を開始できる
- リザルト検出スコアが表示される
- 1レース目入力とリザルト検出が揃った時点で標本が自動作成される
- マッチング候補をRace Historyへ追加できる

## 注意

OBSで管理画面内のoverlay previewだけをクロップして使う想定です。

OBSブラウザソースを別URLで開く方式ではありません。管理UIとoverlay previewを同じページ内に置くことで、サーバー同期なしで動かします。
