using UnityEngine;
using UnityEngine.UI;

namespace Larek.UI
{
    /// <summary>
    /// Точка входа UI. Создаёт Canvas, EventSystem и все контроллеры в рантайме:
    /// никаких префабов и сцен трогать не нужно. Порядок дочерних слоёв задаёт
    /// порядок наложения: поздний слой рисуется поверх раннего.
    /// </summary>
    public static class UiBootstrap
    {
        private static bool bootstrapped;
        private static GameObject uiRoot;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (bootstrapped) return;
            bootstrapped = true;

            UiFactory.EnsureEventSystem();
            UiSettings.Instance.Apply();

            uiRoot = new GameObject("Larek UI", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            Object.DontDestroyOnLoad(uiRoot);

            Canvas canvas = uiRoot.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10000;
            canvas.pixelPerfect = false;

            CanvasScaler scaler = uiRoot.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1600f, 900f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;
            scaler.referencePixelsPerUnit = 100f;

            Transform parent = uiRoot.transform;

            // Нижние слои: HUD и экранное управление.
            HudController.Ensure(parent);
            TouchControls.Ensure(parent);
            DialogController.Ensure(parent);

            // Окна, которые перекрывают мир.
            TradePanelController.Ensure(parent);
            TitleScreenController.Ensure(parent);
            SheetController.Ensure(parent);
            NotepadController.Ensure(parent);
            PaperReaderController.Ensure(parent);

            // Верхние слои: админ-панель, модальные окна и затемнение.
            AdminPanelController.Ensure(parent);
            ModalController.Ensure(parent);

            TitleScreenController.ShowGlobal();
        }
    }
}
