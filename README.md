# MK Lounge Static Scorer

MK8DXラウンジ向けの完全静的な集計アプリです。

この版ではサーバーを使いません。管理UIとOBS用overlay表示を同じページ内に置き、OBS側でoverlay部分をクロップして使う方針です。

## MVP方針

- 1レース目はOCRせず、ユーザーが完全に手入力する
- 2レース目以降はブラウザ内の画像マッチングで自動判定する
- 集計結果は同じ画面内のoverlay previewに表示する
- OBSではoverlay preview部分だけをクロップする
- 状態はブラウザのlocalStorage / IndexedDBに保存する
- サーバー、DB、WebSocketは使わない

## 現在できること

Milestone 1:

- 1レース目以降の手入力
- 順位別点数の自動計算
- チーム別集計
- 管理画面内overlay preview
- 自チーム強調表示
- Race History編集
- localStorage保存
- Reset All

Milestone 2:

- `getDisplayMedia` による画面共有
- videoからcanvasへのフレーム描画
- 1280x720基準の順位テンプレート読み込み
- 1〜12位のrank score算出
- リザルト画面らしさの判定
- 判定スコアの画面表示

Milestone 3:

- 検出フレームから12行分の名前画像特徴量を作成
- 1レース目の手入力結果と特徴量を結びつけて標本保存
- 保存標本を使って2レース目以降の検出フレームをマッチング
- 12行全体の割当最適化
- マッチング候補をユーザー確認用に表示
- 候補をRace Historyへ追加

## ローカルで開く

ビルドは不要です。画面共有とテンプレート画像読み込みを使うため、ローカルHTTPサーバー経由で開くのがおすすめです。

```bash
python3 -m http.server 8000
```

その後、以下を開きます。

```text
http://localhost:8000/
```

## OBSでの使い方

1. ブラウザでアプリを開く
2. 管理UIでレース結果を入力する
3. OBSでブラウザ画面をキャプチャする
4. 右側の `Overlay Preview` 部分だけをクロップする

画面共有を開始すると、順位テンプレートとの一致スコアが管理画面に表示されます。1レース目入力後にリザルト画面を検出すると、`Build Specimens` で標本を作れます。標本作成後は、次の検出フレームからマッチング候補が表示されます。

## テスト

```bash
python3 -m pytest -q
```
