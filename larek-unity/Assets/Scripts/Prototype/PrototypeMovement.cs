using UnityEngine;
using UnityEngine.EventSystems;

namespace Larek.Prototype
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class PrototypeMovement : MonoBehaviour
    {
        public Transform View;
        public Vector2 MoveInput;
        private CharacterController controller;
        private float verticalSpeed;
        private float pitch;
        private int lookFinger = -1;
        private Vector2 previousLook;

        private void Awake() => controller = GetComponent<CharacterController>();

        private void Update()
        {
            Vector2 input = Vector2.ClampMagnitude(MoveInput + new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical")), 1);
            if (controller.isGrounded && verticalSpeed < 0) verticalSpeed = -2;
            verticalSpeed += Physics.gravity.y * Time.deltaTime;
            Vector3 velocity = (transform.right * input.x + transform.forward * input.y) * 2.5f;
            velocity.y = verticalSpeed;
            controller.Move(velocity * Time.deltaTime);

            foreach (Touch touch in Input.touches)
            {
                if (touch.phase == TouchPhase.Began && lookFinger == -1 && touch.position.x > Screen.width * 0.45f &&
                    (EventSystem.current == null || !EventSystem.current.IsPointerOverGameObject(touch.fingerId)))
                {
                    lookFinger = touch.fingerId;
                    previousLook = touch.position;
                }
                if (touch.fingerId != lookFinger) continue;
                if (touch.phase == TouchPhase.Ended || touch.phase == TouchPhase.Canceled) { lookFinger = -1; continue; }
                Vector2 delta = touch.position - previousLook;
                previousLook = touch.position;
                transform.Rotate(0, delta.x * 0.15f, 0);
                pitch = Mathf.Clamp(pitch - delta.y * 0.15f, -80, 80);
                if (View != null) View.localRotation = Quaternion.Euler(pitch, 0, 0);
            }
        }
    }

    public sealed class PrototypeTouchStick : MonoBehaviour, IDragHandler, IPointerDownHandler, IPointerUpHandler
    {
        public PrototypeMovement Player;
        public void OnPointerDown(PointerEventData eventData) => OnDrag(eventData);
        public void OnDrag(PointerEventData eventData)
        {
            var rect = (RectTransform)transform;
            if (Player != null && RectTransformUtility.ScreenPointToLocalPointInRectangle(rect, eventData.position, eventData.pressEventCamera, out Vector2 local))
                Player.MoveInput = Vector2.ClampMagnitude(local / (rect.rect.width * 0.5f), 1);
        }
        public void OnPointerUp(PointerEventData eventData) { if (Player != null) Player.MoveInput = Vector2.zero; }
        private void OnDisable() { if (Player != null) Player.MoveInput = Vector2.zero; }
    }
}
