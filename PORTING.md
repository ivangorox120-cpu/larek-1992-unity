# Карта переноса «Ларёк 1992» на Unity

Исходник: `larek-original/` (Build 232, Three.js + HTML). Целевой проект: `larek-unity/` (Unity 2022.3.62f1).

| Оригинал | Unity-ассембли / файлы | Статус |
|---|---|---|
| `js/game.js` — состояние игры, экономика, сохранения, меню | `Larek.Economy`, `Larek.Gameplay` | перенесено |
| `js/world.js` — мир, ларёк, квартира, свет, погода, LOD | `Larek.World` | перенесено |
| `js/transport.js` — 8 остановок, автобус ПАЗ-652, заездные карманы | `Larek.Systems/TransportSystem.cs` | перенесено |
| `js/npc.js` — люди, outward/зима, диалоги, ragdoll | `Larek.Systems/NpcSystem.cs`, `RagdollSystem.cs` | перенесено |
| `js/phone.js` — домофон, код 1992 | `Larek.Systems/PhoneSystem.cs`, `Larek.Interactions` | перенесено |
| `js/weapon.js` — оружие, выстрелы, гильзы | `Larek.Systems/WeaponSystem.cs` | перенесено |
| `js/hand.js` — руки, позы, гитара, сигарета | `Larek.Systems/HandSystem.cs` | перенесено |
| `js/fridge_zil.js` — холодильник ЗИЛ-Москва КХ-240 | `Larek.Systems/FridgeSystem.cs` | перенесено |
| `js/ragdoll.js`, `js/rope.js` — физика предметов, верёвка, люк | `Larek.Systems/RagdollSystem.cs`, `RopeSystem.cs` | перенесено |
| `js/audio.js` — 3D-звук, 27 клипов | `Larek.Systems/AudioSystem.cs`, `Larek.World/WorldAudio.cs` | перенесено |
| `js/controls.js` — клавиши, джойстик, настройки | `Larek.Systems/ControlsSystem.cs`, `Larek.UI/TouchControls.cs` | перенесено |
| `js/extras.js`, `js/life.js` — предметы, квартира, взаимодействия | `Larek.Gameplay/Inventory.cs`, `Larek.World/WorldInteractions.cs` | перенесено |
| `index.html` — HUD, панели, модалки, подсказки | `Larek.UI` | перенесено |
| `MECHANICS.md` — реестр механик M01–M90 | `Larek.Porting/MechanicsCoverage.cs`, `PortCoverageTests.cs` | покрыто |

Ресурсы оригинала (81 GLB, 62 текстуры, 27 аудио, 10 видео, 25 иконок, 5 шрифтов) скопированы в
`larek-unity/Assets/StreamingAssets/Game/` и загружаются во время исполнения. GLB загружаются через
UnityGLTF (рефлексивный адаптер с fallback на примитивы, если пакет недоступен).

Проверка полноты: Unity Test Runner, режим EditMode; цель — зелёные тесты всех ассембли и успешная Android-сборка
через `Larek/Build Full Game` / GitHub Actions `Unity test and build`.

Ограничение: визуальное совпадение с WebGL-оригиналом и физика Mali-G78 требуют запуска на целевом устройстве;
в среде разработки нет Unity Editor и лицензии, поэтому финальная сборка проверяется только в CI.
