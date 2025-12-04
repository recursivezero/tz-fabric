import { NavLink } from 'react-router-dom';

export const NotFound = () => {
  return (
    <div style={ { textAlign: "center", paddingTop: "5rem" } }>
      <h1>404</h1>
      <p>The page you are looking for does not exist.</p>
      <NavLink to="/">Go Home</NavLink>
    </div>
  );
}
