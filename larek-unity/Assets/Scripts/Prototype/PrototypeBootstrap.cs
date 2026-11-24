using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Larek.Prototype
{
    public sealed class PrototypeBootstrap : MonoBehaviour
    {
        private static Material Material(Color color)
        {
            var material = new Material(Shader.Find("Standard"));
            material.color = color;
            return material;
        }

        private static GameObject Box(string name, Vector3 position, Vector3 scale, Material material)
        {
            GameObject obj = GameObject.CreatePrimitive(PrimitiveType.Cube);
            obj.name = name;
            obj.transform.position = position;
            obj.transform.localScale = scale;
            obj.GetComponent<Renderer>().sharedMaterial = material;
            return obj;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void StartPrototype()
        {
            if (FindObjectOfType<PrototypeBootstrap>() != null) return;
            new GameObject("Larek Prototype").AddComponent<PrototypeBootstrap>();
        }

        private void Start()
        {
            var ground = Material(new Color(0.63f, 0.67f, 0.68f));
            var walls = Material(new Color(0.16f, 0.29f, 0.34f));
            var roof = Material(new Color(0.28f, 0.29f, 0.29f));
            var wood = Material(new Color(0.42f, 0.29f, 0.18f));
            Box("Ground", new Vector3(0, -0.1f, 0), new Vector3(60, 0.2f, 60), ground);
            Box("Back wall", new Vector3(0, 1.25f, 1.6f), new Vector3(4, 2.5f, 0.12f), walls);
            Box("Left wall", new Vector3(-2, 1.25f, 0), new Vector3(0.12f, 2.5f, 3.2f), walls);
            Box("Right wall", new Vector3(2, 1.25f, 0), new Vector3(0.12f, 2.5f, 3.2f), walls);
            Box("Front counter", new Vector3(0, 0.55f, -1.6f), new Vector3(4, 1.1f, 0.12f), walls);
            Box("Roof", new Vector3(0, 2.6f, 0), new Vector3(4.3f, 0.2f, 3.5f), roof);
            Box("Counter", new Vector3(0, 1.05f, -1.15f), new Vector3(3.5f, 0.12f, 0.7f), wood);
            var light = new GameObject("Sun").AddComponent<Light>();
            light.type = LightType.Directional;
            light.transform.rotation = Quaternion.Euler(50, -30, 0);
            light.intensity = 1f;
            RenderSettings.ambientLight = new Color(0.65f, 0.65f, 0.65f);
            var player = new GameObject("Player");
            player.transform.position = new Vector3(0, 1, -5);
            player.AddComponent<CharacterController>();
            var camera = new GameObject("Player camera").AddComponent<Camera>();
            camera.tag = "MainCamera";
            camera.transform.SetParent(player.transform, false);
            camera.transform.localPosition = new Vector3(0, 0.66f, 0);
            camera.gameObject.AddComponent<AudioListener>();
            var controller = player.AddComponent<PrototypeMovement>();
            controller.View = camera.transform;
            CreateControls(controller);
        }

        private static void CreateControls(PrototypeMovement controller)
        {
            if (FindObjectOfType<EventSystem>() == null)
            {
                var events = new GameObject("EventSystem");
                events.AddComponent<EventSystem>();
                events.AddComponent<StandaloneInputModule>();
            }
            var canvasObject = new GameObject("Prototype UI");
            var canvas = canvasObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvasObject.AddComponent<CanvasScaler>();
            canvasObject.AddComponent<GraphicRaycaster>();
            var controls = new GameObject("Touch move");
            controls.transform.SetParent(canvasObject.transform, false);
            var image = controls.AddComponent<Image>();
            image.color = new Color(1, 1, 1, 0.25f);
            var rect = controls.GetComponent<RectTransform>();
            rect.anchorMin = rect.anchorMax = new Vector2(0, 0);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = new Vector2(100, 100);
            rect.sizeDelta = new Vector2(150, 150);
            var touch = controls.AddComponent<PrototypeTouchStick>();
            touch.Player = controller;
        }
    }
}
