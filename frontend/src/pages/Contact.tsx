import { useState } from "react";
import "@/assets/styles/contact.css";
import { FULL_API_URL } from '@/constants';

export const ContactUs = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("");

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("Sending...");

    const res = await fetch(`${FULL_API_URL}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setStatus("Message sent!");
      setForm({ name: "", email: "", message: "" });
    } else {
      setStatus("Failed to send!");
    }
  };

  return (
    <div className="contact-container">
      <h2>Contact Us</h2>
      

      <form onSubmit={ handleSubmit }>
        <input
          name="name"
          placeholder="Your Name"
          value={ form.name }
          onChange={ handleChange }
          required
        />

        <input
          name="email"
          type="email"
          placeholder="Your Email"
          value={ form.email }
          onChange={ handleChange }
          required
        />

        <textarea
          name="message"
          placeholder="Message"
          value={ form.message }
          onChange={ handleChange }
          required
        />

        <button type="submit">Send</button>
      </form>
      <br />
      <div className='notice'>
      <span>Or</span>
      <p>You can mail us on <a href="mailto:threadzip@gmail.com"><mark>threadzip@gmail.com</mark></a></p>
      
      </div>
      <p className="status">{ status }</p>
    </div>
  );
}
